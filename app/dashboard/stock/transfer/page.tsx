import { redirect } from "next/navigation";

export default async function StockTransferRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const queryString = new URLSearchParams(params as any).toString();
  redirect(`/dashboard/stock/transit${queryString ? `?${queryString}` : ""}`);
}
