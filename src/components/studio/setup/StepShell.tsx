/**
 * StepShell — visual chrome shared by every wizard step.
 * Renders the progress strip, the step title/subtitle, and the
 * Back / Continue buttons. Keeps individual step files focused on
 * their form content.
 */
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  hideBack?: boolean;
};

export default function StepShell({
  step,
  total,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  loading,
  hideBack,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i + 1 === step
                ? "w-10 bg-primary"
                : i + 1 < step
                  ? "w-6 bg-primary/60"
                  : "w-6 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Step {step} of {total}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
        {children}
      </div>

      <div className="flex items-center justify-between mt-6">
        {hideBack ? (
          <span />
        ) : (
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={loading || !onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        <Button onClick={onNext} disabled={loading || nextDisabled} size="lg">
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          {nextLabel}
          {!loading ? <ArrowRight className="w-4 h-4 ml-2" /> : null}
        </Button>
      </div>
    </div>
  );
}