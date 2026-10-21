import { ClientList } from '../_components/client-list';
import { SignInGate } from '../_components/sign-in-gate';

export default function ClientsPage() {
  return (
    <SignInGate>
      <ClientList />
    </SignInGate>
  );
}
