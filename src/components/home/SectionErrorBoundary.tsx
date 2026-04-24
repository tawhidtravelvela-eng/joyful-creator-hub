import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[SectionErrorBoundary][${this.props.sectionName || "Section"}] render error:`, error.message, error.stack);
  }

  render() {
    if (this.state.hasError) {
      // In development, show a subtle indicator so we know which section crashed
      if (import.meta.env.DEV) {
        return (
          <div className="py-2 text-center text-xs text-destructive/50">
            [{this.props.sectionName}] failed to render: {this.state.error?.message}
          </div>
        );
      }
      return null;
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
