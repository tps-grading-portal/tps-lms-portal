import { redirect } from 'next/navigation'

// Legacy admin login — redirect to unified login
export default function AdminLoginPage() {
  redirect('/login')
}
