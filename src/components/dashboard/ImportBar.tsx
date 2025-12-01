import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export function ImportBar() {
  const [orderText, setOrderText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'txt' || fileExtension === 'csv') {
        // Read text files directly
        const text = await file.text();
        setOrderText(text);
        toast({
          title: "File loaded",
          description: `${file.name} loaded. Click "Parse & Import" to process.`,
        });
      } else if (fileExtension === 'pdf') {
        toast({
          title: "Processing PDF",
          description: "Extracting text from PDF file...",
        });
        
        try {
          // Read file as array buffer
          const arrayBuffer = await file.arrayBuffer();
          
          // Load PDF document
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          let extractedText = '';
          
          // Extract text from all pages
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            extractedText += pageText + '\n';
          }
          
          if (extractedText.trim()) {
            setOrderText(extractedText);
            toast({
              title: "PDF text extracted",
              description: `${file.name} processed. Click "Parse & Import" to continue.`,
            });
          } else {
            throw new Error('No text found in PDF');
          }
        } catch (pdfError) {
          console.error('PDF extraction error:', pdfError);
          toast({
            title: "PDF processing failed",
            description: "Could not auto-extract text. Please copy the order text from your PDF and paste it below.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Unsupported file type",
          description: "Please upload a .txt, .csv, or .pdf file",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Failed to read file",
        description: "Please try again or paste the text manually.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleParse = async () => {
    if (!orderText.trim()) {
      toast({
        title: "No order text",
        description: "Please paste broker order text to parse.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Parse order using edge function
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-order', {
        body: { orderText },
      });

      if (parseError) throw parseError;

      const puts = parseResult.puts || [];
      const calls = parseResult.calls || [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let insertedPuts = 0;
      let insertedCalls = 0;

      // Insert PUTs into positions table
      if (puts.length > 0) {
        const positionsToInsert = puts.map((p: any) => ({
          user_id: user.id,
          raw_order_text: parseResult.raw_order_text || orderText,
          ...p,
        }));

        const { error: insertError } = await supabase
          .from('positions')
          .insert(positionsToInsert);

        if (insertError) throw insertError;
        insertedPuts = puts.length;
      }

      // Insert CALLs into covered_calls table
      if (calls.length > 0) {
        // First, fetch assigned positions to match against
        const { data: assignedPositions, error: assignedError } = await supabase
          .from('assigned_positions')
          .select('id, symbol')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (assignedError) throw assignedError;

        const callsToInsert = [];
        const unmatchedCalls = [];

        for (const call of calls) {
          const matchingPosition = assignedPositions?.find(
            ap => ap.symbol === call.symbol
          );

          if (matchingPosition) {
            callsToInsert.push({
              assigned_position_id: matchingPosition.id,
              strike_price: call.strike_price,
              expiration: call.expiration,
              contracts: call.contracts,
              premium_per_contract: call.premium_per_contract,
            });
          } else {
            unmatchedCalls.push(call.symbol);
          }
        }

        if (callsToInsert.length > 0) {
          const { error: callInsertError } = await supabase
            .from('covered_calls')
            .insert(callsToInsert);

          if (callInsertError) throw callInsertError;
          insertedCalls = callsToInsert.length;
        }

        if (unmatchedCalls.length > 0) {
          toast({
            title: "Some calls couldn't be matched",
            description: `${unmatchedCalls.length} call(s) for ${unmatchedCalls.join(', ')} have no matching assigned positions.`,
            variant: "destructive",
          });
        }
      }

      // Fetch market data for all unique symbols
      const allSymbols = [...new Set([...puts.map((p: any) => p.symbol), ...calls.map((c: any) => c.symbol)])];
      if (allSymbols.length > 0) {
        await Promise.all(
          allSymbols.map(symbol =>
            supabase.functions.invoke('fetch-market-data', { body: { symbol } })
          )
        );
      }

      const totalInserted = insertedPuts + insertedCalls;
      toast({
        title: "Orders parsed successfully",
        description: `${insertedPuts} PUT${insertedPuts !== 1 ? 's' : ''} and ${insertedCalls} CALL${insertedCalls !== 1 ? 's' : ''} added.`,
      });
      setOrderText("");
      setFileName("");
    } catch (error: any) {
      console.error('Parse error:', error);
      toast({
        title: "Failed to parse order",
        description: error.message || "Please check the format and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
        <div>
            <label className="text-sm font-medium mb-2 block">
              Import Broker Order
            </label>
            <div className="flex gap-2 mb-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                Upload File (.txt, .csv, .pdf)
              </Button>
            </div>
            {fileName && (
              <p className="text-xs text-muted-foreground mb-2">
                Loaded: {fileName}
              </p>
            )}
            <Textarea
              placeholder="Or paste broker order text or portfolio export here (supports multiple positions)..."
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={6}
              className="resize-none font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleParse} className="flex-1" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Parsing..." : "Parse & Import"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setOrderText("");
                setFileName("");
              }} 
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
