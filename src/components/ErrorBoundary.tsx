import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ErrorBoundaryState = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error. Reloading usually fixes it; if it keeps happening, we can pinpoint the exact
              component from the error details below.
            </p>
            {this.state.error?.message ? (
              <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto">
                {this.state.error.message}
              </pre>
            ) : null}
            <div className="flex gap-3">
              <Button onClick={this.handleReload}>Reload</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
