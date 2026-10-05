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
- crawl จำกัด 20 URL ที่ลองตรวจ มีลิมิต request/เวลา/bytes และเคารพ robots ของ SEOChecker ไม่รับลิมิตจาก browser เพื่อเพิ่มขอบเขตเอง
- JavaScript เป็นตัวเลือก ใช้ Chromium เปรียบเทียบก่อน/หลังสำหรับไม่เกิน 2 หน้า ไม่ได้จำลอง Googlebot และไม่ยืนยันสถานะ index
- PageSpeed เป็นตัวเลือก ส่ง URL ไป Google ขอ Performance, Accessibility, Best Practices และ SEO เลือก mobile/desktop ได้ คะแนนเป็นของ URL เดียว ไม่เฉลี่ยทั้งเว็บไซต์
- ไม่มี key จะไม่เรียก PageSpeed และแสดงว่ายังไม่ได้ตั้งค่า ดู [ตั้งค่า PageSpeed](docs/project/PAGESPEED.md) ซึ่งยังต้องยืนยันสิทธิ์/quota/คะแนนด้วย key จริง
- Agentic แสดงสัดส่วนเฉพาะเมื่อ provider คืนหลักฐานที่รองรับ ไม่ใช้ Chrome ของเครื่อง checker หรือคะแนนตัวอย่างแทน
- รายงานบอกขอบเขตและสิ่งที่ยังตรวจไม่ได้ ไม่สรุปว่า SEO 100 ต้องติดหน้าแรก หรือว่าตรวจครบโดเมนเมื่อหยุดตามลิมิต

CSV ส่งออกปัญหาตามตัวกรอง JSON รวมรายงานทั้งรอบเป็นข้อความ พร้อมเวลา/schema และชื่อไฟล์แยกรอบ
ทั้งสองอย่างสร้าง Blob เฉพาะตอนกดปุ่ม ไม่สร้างไฟล์อัตโนมัติหลังตรวจ
JSON/หลักฐานอาจมีเนื้อหา HTML หรือ query จากเว็บที่ตรวจ ควรเก็บไฟล์ดาวน์โหลดในเครื่องอย่างเหมาะสม

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
