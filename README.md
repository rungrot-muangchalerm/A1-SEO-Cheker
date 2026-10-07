# SEO Checker

ตรวจ URL จริงเป็นรอบ ๆ ด้วย Express + EJS ของ DevTeam Framework และหน้า Bootstrap 5 CDN แบบ CSR ไม่มี CSS เพิ่ม
ไม่มีฐานข้อมูล ประวัติ หรือระบบกู้รายงานเก่า ผลตรวจอยู่ในหน่วยความจำของรอบปัจจุบัน
การ refresh เป็น reload ปกติของ browser ไม่ใช่ฟีเจอร์ F5 และไม่มีโค้ดดักปุ่ม F5
ผู้ใช้ดาวน์โหลด JSON/XLSX ลงเครื่องเองเท่านั้น ไม่สร้างไฟล์หรือสำเนาที่ backend

## ติดตั้งและรัน

ต้องมี Node.js 22.19.0 ขึ้นไปและ npm สำหรับ Lighthouse ในเครื่อง ใช้โฟลเดอร์ repository นี้ ไม่ใช่ติดตั้ง framework จาก npm เพื่อแทนโค้ด checker

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
```

ตั้งค่าเสร็จแล้วเริ่ม server:

```sh
npm start
```

เปิด `http://localhost:3000` หรือพอร์ตที่ตั้งไว้ หากพอร์ตถูกใช้ให้เลือกพอร์ตอื่นและ restart
โหมดพัฒนาใช้ `npm run dev` และเปิด `LIVERELOAD=true` ได้ ปิด LiveReload ก่อนเผยแพร่
checker ไม่เรียก MySQL/JWT ของ framework จึงไม่ต้องสร้าง database หรือระบบ login เพื่อเริ่มตรวจ
ต้องเข้าถึง Bootstrap/Lucide CDN ได้เพื่อใช้หน้าจอครบ

## รันเบื้องหลังด้วย PM2 บน Windows

ติดตั้ง PM2 แบบ global ครั้งเดียวด้วย `npm.cmd install --global pm2` แล้วเรียกจากโฟลเดอร์โปรเจกต์:

```powershell
npm.cmd run pm2:start
pm2.cmd save
```

`ecosystem.config.js` เปิดโปรเซสชื่อ `seo-checker` เพียงหนึ่งตัวในโหมด fork ใช้ `index.js` และ working directory ของโปรเจกต์
ปิด watch/LiveReload และใช้ `NODE_ENV=production`; PM2 เปิดโปรเซสใหม่หลัง crash โดยเว้น 3 วินาที
ใช้ `PORT` และค่าตรวจเว็บจาก `.env` เดิม ไม่เขียนทับ `.env` และยังรับคำขอเฉพาะ localhost
ห้ามเปิด nodemon หรือ `npm start` ซ้อนบนพอร์ตเดียวกัน

```powershell
npm.cmd run pm2:status
npm.cmd run pm2:restart
npm.cmd run pm2:stop
npm.cmd run pm2:logs
```

หลังแก้ `.env` หรือโค้ดให้ restart เอง; การ restart จะยุติรอบตรวจที่กำลังทำ ไม่กู้ผลเดิม
เมื่อเปลี่ยน config ให้ restart แล้วสั่ง `pm2.cmd save` อีกครั้ง รายการที่บันทึกเก็บใน profile ของบัญชี Windows ที่รัน PM2 ไม่ใช่รายงาน SEO
PM2 มี console logs สำหรับดูการเริ่ม/ข้อผิดพลาดของโปรเซส แต่ checker ยังไม่มีประวัติหรือไฟล์รายงานที่ backend

ปิด terminal ได้โดยเว็บยังทำงาน แต่เครื่องต้องเปิดและไม่เข้า Sleep
รอบนี้ยังไม่ได้ติดตั้ง Windows Service หรือ Task Scheduler สำหรับเริ่มหลังบูต/login
`pm2 save` บันทึกรายการโปรเซสเท่านั้น ไม่ทำให้ Windows เปิด PM2 อัตโนมัติ; ใช้ `pm2.cmd resurrect` เรียกคืนรายการด้วยตนเอง
ดู [PM2 configuration](https://pm2.keymetrics.io/docs/usage/application-declaration/) และ [startup](https://pm2.keymetrics.io/docs/usage/startup/)

## ขอบเขตที่ตรวจ

- แสดงสถานะ `robots.txt` และ sitemap ใต้ภาพรวมทันที พร้อม URL/HTTP ที่ตรวจ แยกพบไฟล์ ยังไม่พบ รูปแบบต้องตรวจ และตรวจไม่ได้
- เมื่อยังไม่พบไฟล์ แสดงคำแนะนำที่ควรพิจารณาแยกจากปัญหา SEO ไม่ถือว่าทุกเว็บต้องมีทั้งสองไฟล์ และไม่เพิ่มคะแนนหรือตัดสินว่าเข้า index ไม่ได้เพราะไฟล์ขาด
- sitemap ใช้ชื่ออื่นได้ถ้าประกาศใน robots.txt; การไม่พบหมายถึงตำแหน่งที่ตรวจเท่านั้น ไม่ยืนยันว่าทั้งโดเมนไม่มี sitemap รายละเอียดอยู่ใน `siteFiles` ของ API/JSON และแท็บ `Site Files` ของ XLSX
- HTML เริ่มต้น: HTTP, title/description, canonical, robots meta/header, รูปที่ไม่มี alt, robots.txt, JSON-LD และ OG สำหรับการแชร์
- Open Graph แจ้ง tag หลักที่ขาด ค่าว่าง ตำแหน่งนอก head และ URL ผิดรูปแบบ พร้อมคำแนะนำในหมวด Open Graph; description เป็นข้อมูลเสริม ไม่บังคับให้ข้อความเท่ากับ title และไม่โหลดรูปเพื่อทำ preview
- Title/description ซ้ำแสดงทุก URL ที่เกี่ยวข้อง พร้อมสัดส่วนใช้ซ้ำ H1, canonical และ noindex ของแต่ละหน้า ช่วยตรวจ template ที่ใช้ชื่อหน้าแรกในหน้าเปลี่ยนรหัสผ่าน โดยไม่เหมาว่า URL ซ้ำต้องเปลี่ยนชื่อหรือเปิด index
- ค้นหา URL และ crawl ใน origin เดียวอัตโนมัติ: ลิงก์/sitemap ซ้อน ปัญหาซ้ำ ลิงก์เสีย canonical เป้าหมาย และ URL ใน sitemap พร้อมหลักฐาน
- crawl ไล่ URL ที่ค้นพบต่อจากทุกหน้าและ sitemap จนหมดคิว ค่าเริ่มต้นรองรับ 5,000 URL ที่ลองตรวจใน 1 ชั่วโมง และเคารพ robots ของ SEOChecker
- ตรวจ JavaScript อัตโนมัติ ใช้ Chromium เปรียบเทียบก่อน/หลังสำหรับไม่เกิน 2 หน้า ไม่ได้จำลอง Googlebot และไม่ยืนยันสถานะ index
- Lighthouse ในเครื่องเปิดไว้เป็นค่าเริ่มต้น ตรวจ Performance, Accessibility, Best Practices และ SEO จริง เลือก mobile/desktop ได้ ไม่ต้องมี API key หรือส่ง URL ไปบริการตรวจของ Google
- คะแนนเป็นของ URL ที่ใส่ ไม่เฉลี่ยทั้งเว็บไซต์ เป็น lab test ภายใต้ข้อจำกัด network ของ checker ไม่ใช่ข้อมูลผู้ใช้จริงหรือการยืนยัน Google index ดู [ตรวจ localhost ด้วย Lighthouse](docs/project/LOCAL-LIGHTHOUSE.md)
- Agentic Browsing ตรวจจริงด้วย Lighthouse ในเครื่อง แสดงสัดส่วนที่ผ่านและรายละเอียดรายข้อ แยกไม่ผ่าน/ตรวจไม่ได้/ไม่เข้าข่าย พร้อมหลักฐาน HTML และส่งออก JSON/XLSX
- รายงานบอกขอบเขตและสิ่งที่ยังตรวจไม่ได้ ไม่สรุปว่า SEO 100 ต้องติดหน้าแรก หรือว่าตรวจครบโดเมนเมื่อหยุดตามลิมิต

JSON มีทั้งรายงานทั้งรอบและเฉพาะปัญหาตามตัวกรอง พร้อมเวลา/schema และชื่อไฟล์แยกรอบ
XLSX ใช้ข้อมูลเดียวกัน แยกเป็นแท็บที่นำเข้า Google Sheets ได้ โดยไม่ใช้ CSV
ทุกไฟล์สร้าง Blob ใน browser เฉพาะตอนกดปุ่ม ไม่สร้างไฟล์อัตโนมัติหลังตรวจ และไม่ส่งผลตรวจไป Google เอง
JSON/หลักฐานอาจมีเนื้อหา HTML หรือ query จากเว็บที่ตรวจ ควรเก็บไฟล์ดาวน์โหลดในเครื่องอย่างเหมาะสม

นำไฟล์ `.xlsx` เข้า Google Sheets ผ่าน **File > Import > Upload** หรืออัปโหลดเข้า Drive แล้วเปิดด้วย Google Sheets
JSON ยังคงเป็นข้อมูลต้นฉบับฉบับเต็ม ไม่ใช่ไฟล์ที่ Sheets เปิดตรง ๆ ดู [ส่งออกและเปิดใน Google Sheets](docs/project/GOOGLE-SHEETS.md)

## ขอบเขตการไล่ตรวจ

ไม่มีเพดานเดิม 20 URL / 60 วินาทีแล้ว เว็บที่ค้นพบ 74 URL จะถูกไล่ตรวจต่อจนหมดคิว
URL ที่ถูก robots บล็อก อ่านไม่ได้ ไม่ใช่ HTML หรือ redirect ไปหน้าที่อ่านแล้วจะมีเหตุผลแยก ไม่ถูกนับเป็น HTML ที่ตรวจสำเร็จ
คำขอทั้งหมดเว้นช่วงอย่างน้อย 500 ms และเคารพ crawl-delay ที่นานกว่านั้น เมื่อยกเลิกหรือการเชื่อมต่อปิด backend ยุติงานและคืนทรัพยากร

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
ข้อจำกัด JavaScript 2 หน้าและ Lighthouse 1 URL ยังแยกจากการตรวจ HTML ทั้งเว็บ

## API คำขอเดียว

หน้าเว็บมีช่อง URL ปุ่มตรวจ และโหมดมือถือ/เดสก์ท็อป ไม่ต้องติ๊กเลือกส่วนที่จะตรวจ
เรียก API โดยตรงได้ด้วย JSON เพียง URL:

```http
POST /api/audits
Content-Type: application/json
Accept: application/json

{"url":"http://localhost:5173/"}
```

API เปิด discovery, crawl, JavaScript และ Lighthouse รวม Agentic เป็นค่าเริ่มต้น
ตอบรายงาน JSON ทั้งรอบ มี HTML/metadata/checks ของหน้า ปัญหา หลักฐาน URL ที่พบ/ข้าม คะแนน และส่วนที่ตรวจไม่ได้
`strategy` เป็นตัวเลือก `mobile` (ค่าเริ่มต้น) หรือ `desktop` ไม่ต้องส่ง flags จากหน้าเว็บ
ถ้าต้องการ progress ให้ส่ง `Accept: application/x-ndjson` ใน POST เดิม ได้ progress frames แล้วจบด้วย report เดียว ไม่มี job ID หรือ API ประวัติ
API ยังรับ `discover`, `crawl`, `render`, `lighthouse` แบบ boolean เพื่อจำกัดขอบเขตเฉพาะงานได้ แต่หน้าเว็บไม่ส่ง flags เหล่านี้
การเปิดครบทุกส่วนไม่ได้ข้าม robots หรือขยายลิมิตเดิม: JavaScript ยังไม่เกิน 2 หน้า และ Lighthouse/Agentic ตรวจ URL ที่ใส่หนึ่ง URL

## Browser Renderer

Linux ที่รองรับอาจต้องติดตั้ง dependencies ด้วย `npx playwright install --with-deps chromium`
รันด้วยบัญชี non-root และ OS/container isolation สำหรับโค้ดเว็บที่ไม่น่าเชื่อถือ Chromium sandbox เปิดอยู่ ไม่ปิด sandbox เพื่อแก้ปัญหาติดตั้ง
เลือก Chrome ที่ติดตั้งไว้ได้ด้วย `RENDER_BROWSER_CHANNEL=chrome` ฝั่ง backend
ถ้าขาด browser/sandbox prerequisites ให้รายงานว่า browser ใช้ไม่ได้ ไม่ปลอม DOM หรือคะแนน
renderer ใช้ network gate แบบ DNS pinning/default ports/same-origin GET, 20 วินาที และ 3 MiB รวม assets
เมื่อเลือก localhost gate อนุญาตเฉพาะ origin และพอร์ตนั้น โดยไม่เปิดสิทธิ์อ่านเครือข่ายภายในทั้งหมด
ไม่โหลดภาพ/fonts/media หรือ assets ข้าม origin ไม่คลิก/ล็อกอิน จึงอาจได้ผลบางส่วนอย่างถูกต้อง

## ทดสอบ

```sh
npm test
npm audit --omit=dev
```

ชุด UI ใช้ Playwright กับ Google Chrome ที่ติดตั้งในเครื่อง (`channel: chrome`)
หากยังไม่มี Chrome ให้ติดตั้งก่อนทดสอบ หรือใช้ `npx playwright install chrome` ตามข้อกำหนดเครื่อง
fixture CDN ใช้ Bootstrap/Lucide/ExcelJS เวอร์ชันตรงกับ CDN จริง ชุดทดสอบมีทั้งผลจำลองสำหรับ UI และ Lighthouse จริงกับเว็บ localhost ที่ควบคุมเอง
ชุดทดสอบตรวจ API/network gates, cancellation, crawl, หลักฐาน, UI, การล้างข้อมูล และไฟล์ดาวน์โหลด
ไม่มีการบันทึกผลเว็บจริงระหว่างตรวจ screenshot ใช้ fixture เท่านั้น

## ใช้ส่วนตัวในเครื่อง

ไม่ต้องมีโดเมน VPS reverse proxy หรือ HTTPS สำหรับตัว checker เปิดผ่าน `http://localhost:3000` ได้
หน้าเว็บและ API อยู่พอร์ตเดียวกัน ใช้ `fetch('/api/audits')` ไม่ต้องเปิด CORS
ให้ server รับเฉพาะ loopback และอย่าเปิดพอร์ตออกอินเทอร์เน็ตหรือใช้ tunnel เมื่อใช้ส่วนตัว
entry point ฟังที่ `127.0.0.1` เท่านั้น รับ Host เป็น localhost/127.0.0.1 ของพอร์ตนั้น และปฏิเสธคำขอตรวจจาก origin อื่นหรือ form POST ที่ไม่ใช่ JSON
URL เป้าหมายรองรับ HTTP/HTTPS ของ `localhost`, `127.0.0.1` หรือ `[::1]` กับพอร์ตของเว็บที่กำลังทำ เช่น `http://localhost:5173/` ไม่บังคับ HTTPS
checker กับเว็บเป้าหมายต้องอยู่คนละพอร์ต ถ้าเว็บใช้ 3000 ให้เปลี่ยน `PORT` ของ checker เป็น 3001 แล้ว restart
สิทธิ์ local ผูกกับ origin ที่ผู้ใช้ใส่เท่านั้น redirect ไม่สามารถข้าม alias/พอร์ตไปอ่านบริการอื่นได้ ยังบล็อก LAN/private IP อื่น และโดเมนสาธารณะที่ resolve ไป private IP
เว็บสาธารณะยังรองรับเฉพาะพอร์ต 80/443 ตาม policy เดิม localhost HTTPS ต้องมี certificate ที่ Node เชื่อถือ ไม่ปิดการตรวจ TLS

เก็บ `.env` ฝั่ง Node.js ไม่ใช่ JavaScript ที่ browser โหลด แม้เป็นเครื่องส่วนตัว ไม่ต้องตั้ง API key สำหรับตรวจ
API เป็น `no-store` ไม่ใช้ request/access logs หรือฐานข้อมูลเก็บรายงาน
รับงานพร้อมกันไม่เกิน 2 รอบ และเริ่มได้ไม่เกิน 10 รอบต่อ 10 วินาที ไม่มีคิวงาน หากเต็มให้ลองใหม่หลังงานเดิมสิ้นสุด
ตัวควบคุมเก็บแค่จำนวนงานและเวลาหน้าต่างชั่วคราวใน RAM ไม่เก็บ URL หรือผลตรวจ การปิดแท็บคืนช่องหลัง cleanup เสร็จ
อย่าเปิด DEBUG HTTP หรือ dump environment เพื่อไม่ให้ข้อมูลของเว็บที่ตรวจหลุดใน log
Lighthouse ใช้ Chrome/Chromium ในเครื่อง ไม่มีบริการคะแนนภายนอก แต่ยังโหลด resource ของเว็บเป้าหมายและ public CDN ที่หน้าเว็บอ้างถึง
ไม่มีงาน deploy/SSL/hosting ที่ต้องทำเพื่อใช้งานส่วนตัวตามขอบเขตปัจจุบัน

## เอกสาร

- [แผนงานและสถานะ](TODO.md)
- [Schema และข้อจำกัด](docs/project/AUDIT-SCHEMA.md)
- [รายละเอียด checker](docs/project/readme.md)
- [DevTeam Framework ต้นฉบับ](docs/framework/README.md)

## License

MIT License
