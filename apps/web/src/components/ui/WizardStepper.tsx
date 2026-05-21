interface IWizardStep {
  title: string;
  description: string;
}

interface IWizardStepperProps {
  steps: IWizardStep[];
  activeStep?: number;
}

export function WizardStepper({ activeStep = 0, steps }: IWizardStepperProps) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div
          className={`stepper__item ${index === activeStep ? 'stepper__item--active' : ''} ${index < activeStep ? 'stepper__item--done' : ''}`}
          key={step.title}
        >
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
