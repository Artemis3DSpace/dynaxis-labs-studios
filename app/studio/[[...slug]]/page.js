import StandaloneShell from '@/components/StandaloneShell';
import { DYNAXIS_METADATA } from '@/lib/dynaxis/product';

export const metadata = {
  title: DYNAXIS_METADATA.titleStudio,
};

export default function StudioPage() {
  return <StandaloneShell />;
}
