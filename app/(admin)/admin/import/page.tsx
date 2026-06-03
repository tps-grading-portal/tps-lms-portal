import { ImportWizard } from './import-wizard'
import Link from 'next/link'
import { db } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Import Grades' }

export default async function ImportPage() {
  const [classes, criteria, scenarios, staff] = await Promise.all([
    db.class.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }], select: { id: true, name: true } }),
    db.criterion.findMany({ where: { classId: null, isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, code: true, name: true } }),
    db.scenario.findMany({ where: { isActive: true }, orderBy: { number: 'asc' }, select: { id: true, number: true, label: true } }),
    db.staffMember.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-tps-blue">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-tps-navy">Import Historical Grades</h1>
      </div>

      <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How it works</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Upload your Excel file (.xlsx or .csv)</li>
          <li>Preview the first rows and tell the system which column contains which field</li>
          <li>The system validates the mapping and shows what will be imported</li>
          <li>Confirm — records are created as finalized historical sessions</li>
        </ol>
      </div>

      <ImportWizard classes={classes} criteria={criteria} scenarios={scenarios} staffMembers={staff} />
    </div>
  )
}
