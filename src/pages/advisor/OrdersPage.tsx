import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Client {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
}

export default function OrdersPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [orderText, setOrderText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clients')
        .select('id, user_id, name, email')
        .eq('advisor_id', user.id)
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Failed to load clients",
        description: "Could not fetch client list.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'txt' || fileExtension === 'csv') {
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
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          let extractedText = '';
          
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
    if (!selectedClientId) {
      toast({
        title: "No client selected",
        description: "Please select a client before importing orders.",
        variant: "destructive",
      });
      return;
    }

    if (!orderText.trim()) {
      toast({
        title: "No order text",
        description: "Please paste broker order text to parse.",
        variant: "destructive",
      });
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (!selectedClient?.user_id) {
      toast({
        title: "Client not linked",
        description: "This client doesn't have a linked user account yet.",
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

      let insertedPuts = 0;
      let insertedCalls = 0;

      // Insert PUTs into positions table
      if (puts.length > 0) {
        const positionsToInsert = puts.map((p: any) => ({
          user_id: selectedClient.user_id,
          raw_order_text: parseResult.raw_order_text || orderText,
          source: 'ADVISOR_ALLOCATION',
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
        // Fetch assigned positions for the selected client
        const { data: assignedPositions, error: assignedError } = await supabase
          .from('assigned_positions')
          .select('id, symbol')
          .eq('user_id', selectedClient.user_id)
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
            description: `${unmatchedCalls.length} call(s) for ${unmatchedCalls.join(', ')} have no matching assigned positions for ${selectedClient.name}.`,
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

      toast({
        title: "Orders imported successfully",
        description: `${insertedPuts} PUT${insertedPuts !== 1 ? 's' : ''} and ${insertedCalls} CALL${insertedCalls !== 1 ? 's' : ''} added to ${selectedClient.name}'s account.`,
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

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Orders & Activity</h2>
        <p className="text-muted-foreground">Import broker orders for your clients</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a client to import orders for..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name} {client.email && `(${client.email})`}
                  {!client.user_id && " - Not linked"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClient && !selectedClient.user_id && (
            <p className="text-sm text-destructive mt-2">
              This client doesn't have a linked user account. Orders cannot be imported until they accept their invitation.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className={!selectedClient?.user_id ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle>Import Broker Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Upload File or Paste Text
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
                disabled={loading || !selectedClient?.user_id}
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
              placeholder="Or paste broker order text here (supports multiple positions)..."
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={8}
              className="resize-none font-mono text-xs"
              disabled={!selectedClient?.user_id}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleParse} 
              className="flex-1" 
              disabled={loading || !selectedClient?.user_id}
            >
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
        </CardContent>
      </Card>
    </div>
  );
}
