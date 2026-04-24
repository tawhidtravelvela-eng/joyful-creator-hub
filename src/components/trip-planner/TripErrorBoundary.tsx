import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class TripErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[TripErrorBoundary] Caught:", error.message, error.stack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive/70" />
          <h3 className="text-lg font-semibold text-foreground">Something went wrong</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            The trip planner encountered an unexpected error. Your conversation is saved — try again.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-destructive/60 max-w-lg overflow-auto bg-muted/30 p-2 rounded">
              {this.state.error.message}
            </pre>
          )}
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default TripErrorBoundary;
