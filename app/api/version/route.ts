/** 回傳本次部署的版本號，供已開啟的 App 檢查是否有新版本 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? "" });
}
