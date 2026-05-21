interface IWizardStep {
  title: string;
  description: string;
}

interface IWizardStepperProps {
  steps: IWizardStep[];
}

export function WizardStepper({ steps }: IWizardStepperProps) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div className="stepper__item" key={step.title}>
          <div className="stepper__index">{index + 1}</div>
          <div>
            <strong>{step.title}</strong>
            <p className="card__meta">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
