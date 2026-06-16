import type { ReactNode } from 'react'

export type AdminTableColumn<T> = {
  header: string
  cell: (row: T) => ReactNode
  width?: string
  align?: 'left' | 'right'
}

type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyState?: ReactNode
  caption: string
  /** Optional row-level className (lifecycle state highlight, etc.) */
  rowClassName?: (row: T) => string | undefined
}

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  caption,
  rowClassName,
}: AdminTableProps<T>) {
  if (rows.length === 0) {
    return (
      emptyState ?? (
        <p className="text-sm text-ink-A text-center py-8">沒有資料</p>
      )
    )
  }
  return (
    <table
      data-component="AdminTable"
      className="w-full text-sm border-collapse"
    >
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line">
          {columns.map((c) => (
            <th
              key={c.header}
              scope="col"
              className={[
                'py-2 px-2 text-xs text-ink-A font-normal',
                c.width,
                c.align === 'right' ? 'text-right' : 'text-left',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            className={[
              'border-b border-line-soft hover:bg-black/5',
              rowClassName?.(row),
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {columns.map((c) => (
              <td
                key={c.header}
                className={[
                  'py-3 px-2 text-ink-AAA',
                  c.width,
                  c.align === 'right' ? 'text-right' : 'text-left',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
