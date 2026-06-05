import { redirect } from 'next/navigation'

// Class creation is now unified — use the Comp Oral class creator
export default function GradebookNewClassRedirect() {
  redirect('/admin/classes/new')
}
