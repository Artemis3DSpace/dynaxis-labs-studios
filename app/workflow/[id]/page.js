import StandaloneShell from '@/components/StandaloneShell';
import { DYNAXIS_METADATA } from '@/lib/dynaxis/product';

export const metadata = {
  title: DYNAXIS_METADATA.titleWorkflow,
};

export default function WorkflowPage() {
  return <StandaloneShell />;
}
