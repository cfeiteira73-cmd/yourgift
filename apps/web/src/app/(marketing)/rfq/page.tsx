import { redirect } from 'next/navigation';

// /rfq redirects to /quote (canonical URL for the quote request form)
export default function RfqPage() {
  redirect('/quote');
}
