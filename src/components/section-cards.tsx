import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle, Building2, CircleDollarSign, UserPlus, Wrench } from "lucide-react"

export type SectionCardsStats = {
  totalProperties: number
  rentCollectedThisMonth: number
  overduePayments: number
  openMaintenance: number
  activeLeads: number
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
})

export function SectionCards({ stats }: { stats: SectionCardsStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
      <Card className="@container/card">
        <CardHeader className="space-y-1">
          <CardDescription>Total Properties</CardDescription>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats.totalProperties}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <Building2 className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader className="space-y-1">
          <CardDescription>Rent Collected (This Month)</CardDescription>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {gbp.format(stats.rentCollectedThisMonth)}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CircleDollarSign className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader className="space-y-1">
          <CardDescription>Overdue Payments</CardDescription>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats.overduePayments}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader className="space-y-1">
          <CardDescription>Open Maintenance</CardDescription>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats.openMaintenance}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Wrench className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader className="space-y-1">
          <CardDescription>Active Leads</CardDescription>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {stats.activeLeads}
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <UserPlus className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
