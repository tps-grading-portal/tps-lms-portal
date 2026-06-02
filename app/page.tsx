import { redirect } from 'next/navigation'

// Root URL — redirect to admin login
export default function RootPage() {
  redirect('/admin/login')
}
