import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";

const CITY_GAZETTEER: { keys: string[]; lat: number; lng: number; zh: string; en: string }[] = [
  { keys: ["京都", "kyoto"], lat: 35.0116, lng: 135.7681, zh: "京都, 日本", en: "Kyoto, Japan" },
  { keys: ["东京", "新宿", "涩谷", "tokyo", "shinjuku", "shibuya"], lat: 35.6762, lng: 139.6503, zh: "东京, 日本", en: "Tokyo, Japan" },
  { keys: ["大阪", "osaka"], lat: 34.6937, lng: 135.5023, zh: "大阪, 日本", en: "Osaka, Japan" },
  { keys: ["美瑛", "富良野", "biei", "hokkaido", "北海道"], lat: 43.5902, lng: 142.4689, zh: "美瑛, 日本", en: "Biei, Hokkaido" },
  { keys: ["札幌", "sapporo"], lat: 43.0618, lng: 141.3545, zh: "札幌, 日本", en: "Sapporo, Japan" },
  { keys: ["上海", "shanghai"], lat: 31.2304, lng: 121.4737, zh: "上海, 中国", en: "Shanghai, China" },
  { keys: ["北京", "beijing"], lat: 39.9042, lng: 116.4074, zh: "北京, 中国", en: "Beijing, China" },
  { keys: ["杭州", "hangzhou"], lat: 30.2741, lng: 120.1551, zh: "杭州, 中国", en: "Hangzhou, China" },
  { keys: ["成都", "chengdu"], lat: 30.5728, lng: 104.0668, zh: "成都, 中国", en: "Chengdu, China" },
  { keys: ["深圳", "shenzhen"], lat: 22.5431, lng: 114.0579, zh: "深圳, 中国", en: "Shenzhen, China" },
  { keys: ["广州", "guangzhou"], lat: 23.1291, lng: 113.2644, zh: "广州, 中国", en: "Guangzhou, China" },
  { keys: ["香港", "hong kong", "hongkong"], lat: 22.3193, lng: 114.1694, zh: "香港, 中国", en: "Hong Kong" },
  { keys: ["台北", "taipei"], lat: 25.033, lng: 121.5654, zh: "台北", en: "Taipei" },
  { keys: ["川西", "康定", "新都桥", "kangding"], lat: 30.0509, lng: 101.9625, zh: "川西, 中国", en: "Western Sichuan, China" },
  { keys: ["拉萨", "西藏", "lhasa", "tibet"], lat: 29.6525, lng: 91.1721, zh: "拉萨, 中国", en: "Lhasa, China" },
  { keys: ["新疆", "伊犁", "赛里木湖", "yili"], lat: 43.9169, lng: 81.3241, zh: "伊犁, 中国", en: "Yili, China" },
  { keys: ["首尔", "seoul"], lat: 37.5665, lng: 126.978, zh: "首尔, 韩国", en: "Seoul, South Korea" },
  { keys: ["雷克雅未克", "冰岛", "reykjavik", "iceland"], lat: 64.1466, lng: -21.9426, zh: "雷克雅未克, 冰岛", en: "Reykjavik, Iceland" },
  { keys: ["维克", "vik"], lat: 63.4186, lng: -19.006, zh: "维克, 冰岛", en: "Vik, Iceland" },
  { keys: ["克劳斯图尔", "kirkjubaejarklaustur"], lat: 63.7712, lng: -18.1718, zh: "克劳斯图尔, 冰岛", en: "Kirkjubaejarklaustur, Iceland" },
  { keys: ["多洛米蒂", "布莱耶斯", "南蒂罗尔", "dolomites", "braies"], lat: 46.6943, lng: 12.0854, zh: "多洛米蒂, 意大利", en: "Dolomites, Italy" },
  { keys: ["科尔蒂纳", "cortina"], lat: 46.5405, lng: 12.1357, zh: "科尔蒂纳, 意大利", en: "Cortina d'Ampezzo, Italy" },
  { keys: ["五渔村", "cinque terre"], lat: 44.1068, lng: 9.7289, zh: "五渔村, 意大利", en: "Cinque Terre, Italy" },
  { keys: ["罗马", "rome"], lat: 41.9028, lng: 12.4964, zh: "罗马, 意大利", en: "Rome, Italy" },
  { keys: ["米兰", "milan"], lat: 45.4642, lng: 9.19, zh: "米兰, 意大利", en: "Milan, Italy" },
  { keys: ["巴黎", "paris"], lat: 48.8566, lng: 2.3522, zh: "巴黎, 法国", en: "Paris, France" },
  { keys: ["伦敦", "london"], lat: 51.5072, lng: -0.1276, zh: "伦敦, 英国", en: "London, UK" },
  { keys: ["天空岛", "苏格兰", "skye", "scotland"], lat: 57.5359, lng: -6.2263, zh: "天空岛, 苏格兰", en: "Isle of Skye, Scotland" },
  { keys: ["格林德瓦", "瑞士", "grindelwald", "interlaken"], lat: 46.6242, lng: 8.0414, zh: "格林德瓦, 瑞士", en: "Grindelwald, Switzerland" },
  { keys: ["苏黎世", "zurich"], lat: 47.3769, lng: 8.5417, zh: "苏黎世, 瑞士", en: "Zurich, Switzerland" },
  { keys: ["柏林", "berlin"], lat: 52.52, lng: 13.405, zh: "柏林, 德国", en: "Berlin, Germany" },
  { keys: ["黑森林", "black forest"], lat: 48.2775, lng: 8.186, zh: "黑森林, 德国", en: "Black Forest, Germany" },
  { keys: ["纽约", "new york", "nyc"], lat: 40.7128, lng: -74.006, zh: "纽约, 美国", en: "New York, USA" },
  { keys: ["芝加哥", "chicago"], lat: 41.8781, lng: -87.6298, zh: "芝加哥, 美国", en: "Chicago, USA" },
  { keys: ["旧金山", "san francisco"], lat: 37.7749, lng: -122.4194, zh: "旧金山, 美国", en: "San Francisco, USA" },
  { keys: ["优胜美地", "yosemite"], lat: 37.7456, lng: -119.5936, zh: "优胜美地, 美国", en: "Yosemite, USA" },
  { keys: ["犹他", "纪念碑谷", "utah", "monument valley"], lat: 37.0042, lng: -110.0985, zh: "犹他, 美国", en: "Utah, USA" },
  { keys: ["多伦多", "toronto"], lat: 43.6532, lng: -79.3832, zh: "多伦多, 加拿大", en: "Toronto, Canada" },
  { keys: ["温哥华", "班夫", "vancouver", "banff"], lat: 51.1784, lng: -115.5708, zh: "班夫, 加拿大", en: "Banff, Canada" },
  { keys: ["瓦纳卡", "皇后镇", "wanaka", "queenstown"], lat: -44.6966, lng: 169.118, zh: "瓦纳卡, 新西兰", en: "Wanaka, New Zealand" },
  { keys: ["悉尼", "sydney"], lat: -33.8688, lng: 151.2093, zh: "悉尼, 澳大利亚", en: "Sydney, Australia" },
  { keys: ["新加坡", "singapore"], lat: 1.3521, lng: 103.8198, zh: "新加坡", en: "Singapore" },
  { keys: ["曼谷", "bangkok"], lat: 13.7563, lng: 100.5018, zh: "曼谷, 泰国", en: "Bangkok, Thailand" },
];

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated(req))) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const rawLat = sp.get("lat");
  const rawLng = sp.get("lng");

  // Reverse geocoding mode (`?lat=...&lng=...`)
  if (rawLat !== null && rawLng !== null && rawLat !== "" && rawLng !== "") {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "无效的经纬度坐标" }, { status: 400 });
    }
    let nearest: (typeof CITY_GAZETTEER)[number] | null = null;
    let bestDist = Infinity;
    for (const item of CITY_GAZETTEER) {
      const d = Math.hypot(item.lat - lat, item.lng - lng);
      if (d < bestDist) {
        bestDist = d;
        nearest = item;
      }
    }
    if (nearest && bestDist < 0.45) {
      return NextResponse.json({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        location: nearest.zh,
        locationEn: nearest.en,
      });
    }
    try {
      const [zhRes, enRes] = await Promise.all([
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=zh-CN`,
          { headers: { "User-Agent": "GalleryPortfolio/1.0" }, signal: AbortSignal.timeout(4500) }
        ),
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`,
          { headers: { "User-Agent": "GalleryPortfolio/1.0" }, signal: AbortSignal.timeout(4500) }
        ),
      ]);
      if (zhRes.ok) {
        const zhData = await zhRes.json();
        const enData = enRes.ok ? await enRes.json() : null;
        const zhAddr = zhData.address || {};
        const enAddr = enData?.address || {};
        const zhCity = zhAddr.city || zhAddr.town || zhAddr.county || zhAddr.state || "";
        const zhCountry = zhAddr.country || "";
        const enCity = enAddr.city || enAddr.town || enAddr.county || enAddr.state || "";
        const enCountry = enAddr.country || "";
        return NextResponse.json({
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
          location: [zhCity, zhCountry].filter(Boolean).join(", "),
          locationEn: [enCity, enCountry].filter(Boolean).join(", "),
        });
      }
    } catch {
      // ignore network error
    }
    return NextResponse.json({
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      location: "",
      locationEn: "",
    });
  }

  const q = (sp.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "请输入地点名称" }, { status: 400 });
  }

  const lower = q.toLowerCase();
  const localHit = CITY_GAZETTEER.find((item) =>
    item.keys.some((k) => lower.includes(k) || k.includes(lower))
  );
  if (localHit) {
    return NextResponse.json({
      lat: localHit.lat,
      lng: localHit.lng,
      location: localHit.zh,
      locationEn: localHit.en,
    });
  }

  // Fallback to OpenStreetMap Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "LinYuanPortfolio/1.0" },
        signal: AbortSignal.timeout(4500),
      }
    );
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]) {
        return NextResponse.json({
          lat: Number(Number(arr[0].lat).toFixed(4)),
          lng: Number(Number(arr[0].lon).toFixed(4)),
          location: q,
          locationEn: String(arr[0].display_name || "").split(",").slice(0, 2).join(",").trim(),
        });
      }
    }
  } catch {
    // Offline fallback exhausted
  }

  return NextResponse.json({ error: "未能自动识别该地点，请尝试输入主要城市名或手动填写经纬度" }, { status: 404 });
}
