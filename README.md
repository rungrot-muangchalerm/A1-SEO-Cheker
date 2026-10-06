# SEO Checker

ตรวจ URL จริงเป็นรอบ ๆ ด้วย Express + EJS ของ DevTeam Framework และหน้า Bootstrap 5 CDN แบบ CSR ไม่มี CSS เพิ่ม
ไม่มีฐานข้อมูล ประวัติ หรือการกู้รายงานเก่า กด F5 แล้ว URL ผลตรวจ และตัวกรองเริ่มใหม่
ผู้ใช้ดาวน์โหลด CSV/JSON ลงเครื่องเองเท่านั้น ไม่สร้างไฟล์หรือสำเนาที่ backend

## ติดตั้งและรัน

ต้องมี Node.js 20.18.1 ขึ้นไปและ npm ใช้โฟลเดอร์ repository นี้ ไม่ใช่ติดตั้ง framework จาก npm เพื่อแทนโค้ด checker

```sh
npm ci
npx playwright install chromium
```

สร้าง `.env` จาก `example.env` เฉพาะเมื่อยังไม่มีไฟล์เดิม อย่าทับค่าหรือ key ที่ตั้งไว้แล้ว
บน PowerShell:

```powershell
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath example.env -Destination .env }
```

ค่าหลัก:

```dotenv
PORT=3000
LIVERELOAD=false
PAGESPEED_API_KEY=
```

ตั้งค่าเสร็จแล้วเริ่ม server:

```sh
npm start
```

เปิด `http://localhost:3000` หรือพอร์ตที่ตั้งไว้ หากพอร์ตถูกใช้ให้เลือกพอร์ตอื่นและ restart
โหมดพัฒนาใช้ `npm run dev` และเปิด `LIVERELOAD=true` ได้ ปิด LiveReload ก่อนเผยแพร่
checker ไม่เรียก MySQL/JWT ของ framework จึงไม่ต้องสร้าง database หรือระบบ login เพื่อเริ่มตรวจ
ต้องเข้าถึง Bootstrap/Lucide CDN ได้เพื่อใช้หน้าจอครบ

## ขอบเขตที่ตรวจ

- HTML เริ่มต้น: HTTP, title/description, canonical, robots meta/header, รูปที่ไม่มี alt, robots.txt, JSON-LD และ OG สำหรับการแชร์
- เลือกค้นหา URL หรือ crawl ใน origin เดียว: ลิงก์/sitemap ซ้อน ปัญหาซ้ำ ลิงก์เสีย canonical เป้าหมาย และ URL ใน sitemap พร้อมหลักฐาน
- crawl ไล่ URL ที่ค้นพบต่อจากทุกหน้าและ sitemap จนหมดคิว ค่าเริ่มต้นรองรับ 5,000 URL ที่ลองตรวจใน 1 ชั่วโมง และเคารพ robots ของ SEOChecker
- JavaScript เป็นตัวเลือก ใช้ Chromium เปรียบเทียบก่อน/หลังสำหรับไม่เกิน 2 หน้า ไม่ได้จำลอง Googlebot และไม่ยืนยันสถานะ index
- PageSpeed เป็นตัวเลือก ส่ง URL ไป Google ขอ Performance, Accessibility, Best Practices และ SEO เลือก mobile/desktop ได้ คะแนนเป็นของ URL เดียว ไม่เฉลี่ยทั้งเว็บไซต์
- ไม่มี key จะไม่เรียก PageSpeed และแสดงว่ายังไม่ได้ตั้งค่า ดู [ตั้งค่า PageSpeed](docs/project/PAGESPEED.md) ซึ่งยังต้องยืนยันสิทธิ์/quota/คะแนนด้วย key จริง
- Agentic แสดงสัดส่วนเฉพาะเมื่อ provider คืนหลักฐานที่รองรับ ไม่ใช้ Chrome ของเครื่อง checker หรือคะแนนตัวอย่างแทน
- รายงานบอกขอบเขตและสิ่งที่ยังตรวจไม่ได้ ไม่สรุปว่า SEO 100 ต้องติดหน้าแรก หรือว่าตรวจครบโดเมนเมื่อหยุดตามลิมิต

CSV ส่งออกปัญหาตามตัวกรอง JSON รวมรายงานทั้งรอบเป็นข้อความ พร้อมเวลา/schema และชื่อไฟล์แยกรอบ
ทั้งสองอย่างสร้าง Blob เฉพาะตอนกดปุ่ม ไม่สร้างไฟล์อัตโนมัติหลังตรวจ
JSON/หลักฐานอาจมีเนื้อหา HTML หรือ query จากเว็บที่ตรวจ ควรเก็บไฟล์ดาวน์โหลดในเครื่องอย่างเหมาะสม

## ขอบเขตการไล่ตรวจ

ไม่มีเพดานเดิม 20 URL / 60 วินาทีแล้ว เว็บที่ค้นพบ 74 URL จะถูกไล่ตรวจต่อจนหมดคิว
URL ที่ถูก robots บล็อก อ่านไม่ได้ ไม่ใช่ HTML หรือ redirect ไปหน้าที่อ่านแล้วจะมีเหตุผลแยก ไม่ถูกนับเป็น HTML ที่ตรวจสำเร็จ
คำขอทั้งหมดเว้นช่วงอย่างน้อย 500 ms และเคารพ crawl-delay ที่นานกว่านั้น ปุ่มยกเลิก/F5/ปิดแท็บยุติงานและล้างข้อมูลรอบนั้น

ปรับเพดานป้องกัน URL วนและ RAM เต็มได้ใน `.env` แล้ว restart server ไม่ต้องมี VPS หรือบันทึกประวัติ:

| ตัวแปร | ค่าเริ่มต้น | ช่วงที่รองรับ |
|---|---:|---:|
| `CRAWL_MAX_PAGES` | 5000 URL ที่ลองตรวจ | 1-10000 |
| `CRAWL_TIMEOUT_MS` | 3600000 ms (1 ชั่วโมง) | 1000-86400000 |
| `CRAWL_MAX_REQUESTS` | 40000 คำขอ รวม robots/sitemap/redirect | 1-100000 |
| `CRAWL_MAX_HTML_MB` | 128 MiB ของ HTML ที่เก็บใน RAM | 2-256 |
| `DISCOVERY_MAX_URLS` | 10000 URL ที่ค้นพบ | 1-10000 |
| `DISCOVERY_MAX_SITEMAPS` | 100 ไฟล์ sitemap รวม index | 1-1000 |
| `DISCOVERY_TIMEOUT_MS` | 300000 ms (5 นาที) | 1000-3600000 |

ลิมิตกำหนดที่ backend เท่านั้น browser เปลี่ยนเองไม่ได้ เมื่อชนลิมิตจะยังรายงานหน้าที่ตรวจแล้วและ URL ที่เหลือพร้อมเหตุผล
การไล่ครบ URL ที่ค้นพบไม่ยืนยันว่าค้นพบทุกหน้าของโดเมน เช่น หน้าที่ไม่มีลิงก์/sitemap หน้า login หรือ URL อีก origin
ข้อจำกัด JavaScript 2 หน้าและ PageSpeed 1 URL ยังแยกจากการตรวจ HTML ทั้งเว็บ

## Browser Renderer

Linux ที่รองรับอาจต้องติดตั้ง dependencies ด้วย `npx playwright install --with-deps chromium`
รันด้วยบัญชี non-root และ OS/container isolation สำหรับโค้ดเว็บที่ไม่น่าเชื่อถือ Chromium sandbox เปิดอยู่ ไม่ปิด sandbox เพื่อแก้ปัญหาติดตั้ง
เลือก Chrome ที่ติดตั้งไว้ได้ด้วย `RENDER_BROWSER_CHANNEL=chrome` ฝั่ง backend
ถ้าขาด browser/sandbox prerequisites ให้รายงานว่า browser ใช้ไม่ได้ ไม่ปลอม DOM หรือคะแนน
renderer ใช้ network gate แบบ DNS pinning/default ports/same-origin GET, 20 วินาที และ 3 MiB รวม assets
ไม่โหลดภาพ/fonts/media หรือ assets ข้าม origin ไม่คลิก/ล็อกอิน จึงอาจได้ผลบางส่วนอย่างถูกต้อง

## ทดสอบ

```sh
npm test
npm audit --omit=dev
```

ชุด UI ใช้ Playwright กับ Google Chrome ที่ติดตั้งในเครื่อง (`channel: chrome`)
หากยังไม่มี Chrome ให้ติดตั้งก่อนทดสอบ หรือใช้ `npx playwright install chrome` ตามข้อกำหนดเครื่อง
fixture CDN ใช้ Bootstrap/Lucide เวอร์ชันตรงกับ CDN จริง ผล fixture ไม่ใช่คะแนนจาก Google จริง
ชุดทดสอบตรวจ API/network gates, cancellation, crawl, หลักฐาน, UI, การล้างข้อมูล และไฟล์ดาวน์โหลด
ไม่มีการบันทึกผลเว็บจริงระหว่างตรวจ screenshot ใช้ fixture เท่านั้น

## ใช้ส่วนตัวในเครื่อง

ไม่ต้องมีโดเมน VPS reverse proxy หรือ HTTPS สำหรับตัว checker เปิดผ่าน `http://localhost:3000` ได้
หน้าเว็บและ API อยู่พอร์ตเดียวกัน ใช้ `fetch('/api/audits')` ไม่ต้องเปิด CORS
ให้ server รับเฉพาะ loopback และอย่าเปิดพอร์ตออกอินเทอร์เน็ตหรือใช้ tunnel เมื่อใช้ส่วนตัว
entry point ฟังที่ `127.0.0.1` เท่านั้น รับ Host เป็น localhost/127.0.0.1 ของพอร์ตนั้น และปฏิเสธคำขอตรวจจาก origin อื่นหรือ form POST ที่ไม่ใช่ JSON
URL ที่นำมาตรวจยังต้องเป็นเว็บสาธารณะ HTTP/HTTPS เพราะตัวดึงข้อมูลป้องกันการอ่านเครือข่ายภายใน
การรัน checker ในเครื่องไม่ทำให้ตรวจ `http://localhost` หรือ IP ภายในเป็นเป้าหมายได้เอง

เก็บ `.env`/API key ฝั่ง Node.js ไม่ใช่ JavaScript ที่ browser โหลด แม้เป็นเครื่องส่วนตัว
API เป็น `no-store` ไม่ใช้ request/access logs หรือฐานข้อมูลเก็บรายงาน
รับงานพร้อมกันไม่เกิน 2 รอบ และเริ่มได้ไม่เกิน 10 รอบต่อ 10 วินาที ไม่มีคิวงาน หากเต็มให้ลองใหม่หลังงานเดิมสิ้นสุด
ตัวควบคุมเก็บแค่จำนวนงานและเวลาหน้าต่างชั่วคราวใน RAM ไม่เก็บ URL หรือผลตรวจ การปิดแท็บคืนช่องหลัง cleanup เสร็จ
อย่าเปิด DEBUG HTTP หรือ dump environment เพราะคำขอไป Google มี key ใน query
Google เป็นบริการภายนอก ไม่อยู่ภายใต้คำรับประกันการไม่เก็บข้อมูลของ checker
ไม่มีงาน deploy/SSL/hosting ที่ต้องทำเพื่อใช้งานส่วนตัวตามขอบเขตปัจจุบัน

## เอกสาร

- [แผนงานและสถานะ](TODO.md)
- [Schema และข้อจำกัด](docs/project/AUDIT-SCHEMA.md)
- [รายละเอียด checker](docs/project/readme.md)
- [DevTeam Framework ต้นฉบับ](docs/framework/README.md)

## License

MIT License
