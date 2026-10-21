import { ClientRegistrationForm } from '../../_components/client-registration-form';
import { SignInGate } from '../../_components/sign-in-gate';

export default function NewClientPage() {
  return (
    <SignInGate>
      <h1 className="mb-4 text-5 font-semibold text-foreground">
        Register a client
      </h1>
      <ClientRegistrationForm />
    </SignInGate>
  );
}
