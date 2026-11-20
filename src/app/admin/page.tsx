import { isAdminAuthenticated } from "@/lib/auth";
import { getAllGear, getAllPhotos, getCollectionsWithPhotos, getSiteSettings } from "@/lib/queries";
import { getStorageMode } from "@/lib/storage";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return (
      <AdminClient
        authenticated={false}
        storageMode={getStorageMode()}
        initialPhotos={[]}
        initialCollections={[]}
        initialGear={[]}
        initialSettings={{}}
      />
    );
  }

  const [photos, collections, gear, settings] = await Promise.all([
    getAllPhotos({ includeHidden: true }),
    getCollectionsWithPhotos({ includeHidden: true }),
    getAllGear({ includeHidden: true }),
    getSiteSettings(),
  ]);

  return (
    <AdminClient
      authenticated
      storageMode={getStorageMode()}
      initialPhotos={photos}
      initialCollections={collections}
      initialGear={gear}
      initialSettings={settings}
    />
  );
}
