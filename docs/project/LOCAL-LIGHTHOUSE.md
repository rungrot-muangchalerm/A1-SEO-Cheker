# ตรวจ localhost ด้วย Lighthouse

ใช้ Lighthouse 13.5.0 รันกับ Chrome/Chromium ในเครื่อง ไม่ต้องมี API key
ไม่ส่ง URL ไปบริการตรวจคะแนนของ Google และไม่ต้องเปิดเว็บออนไลน์หรือซื้อ VPS

## เริ่มใช้งาน

ต้องใช้ Node.js 22.19.0 ขึ้นไป:

```sh
npm ci
npx playwright install chromium
npm start
```

เปิด checker ที่ `http://localhost:3000` แล้วใส่ URL ของเว็บที่กำลังทำ เช่น
`http://localhost:5173/` หรือ `http://127.0.0.1:8080/`
รองรับ `[::1]` เมื่อเว็บเป้าหมายฟัง IPv6 อยู่ด้วย
ถ้าเว็บใช้พอร์ต 3000 ให้ตั้ง `PORT=3001` ใน `.env` ของ checker แล้ว restart
ห้ามตรวจพอร์ตเดียวกับ checker เพื่อป้องกันการตรวจตัวเองวน

Lighthouse เปิดไว้เป็นค่าเริ่มต้น เลือกมือถือหรือเดสก์ท็อปก่อนกดตรวจ
เลือกไล่ตรวจหน้าในเว็บไซต์เพื่อหาปัญหา HTML หลายหน้าร่วมด้วยได้
หากไม่ต้องการคะแนนในรอบนั้นให้ปิด Lighthouse; HTML/discovery/crawl ยังทำงาน
Lighthouse อ่านหน้าและรัน JavaScript เอง ส่วนตัวเลือกตรวจ JavaScript เป็นการ
เปรียบเทียบ HTML/DOM ก่อนและหลังของไม่เกิน 2 หน้า แยกจากคะแนน Lighthouse

HTTP localhost ใช้ได้ ไม่บังคับ HTTPS ส่วน HTTPS ต้องมี certificate ที่ Node เชื่อถือ
ไม่มีการปิด TLS verification หรือ Chromium sandbox
เลือก Google Chrome ที่ติดตั้งไว้ด้วย `LIGHTHOUSE_BROWSER_CHANNEL=chrome`
หรือใช้ค่า `RENDER_BROWSER_CHANNEL=chrome` ร่วมกันได้ หากไม่ตั้งใช้ Playwright Chromium

## อ่านผล

4 คะแนนคือ Performance, Accessibility, Best Practices และ SEO จาก engine จริง
เก็บค่า 0-1 ต้นฉบับใน JSON แสดงผล 0-100 พร้อม URL, เวลา, version และโหมดจริง
คะแนน 0 คือผลจริง ส่วน `--` หรือไม่มีคะแนนหมายถึงตรวจไม่ได้ ไม่แทนด้วย 0/100
คะแนนเป็นของ URL ที่ใส่เท่านั้น ไม่เฉลี่ยหลายหน้า และไม่รับประกันอันดับค้นหา

เมื่อ resource บางส่วนโหลดไม่ได้ ผลเป็น partial พร้อมเหตุผลและ network evidence
คะแนนที่มีอยู่ยังเป็นค่าจาก engine ภายใต้การโหลดครั้งนั้น ไม่ใช่ค่าประมาณของ checker
ถ้า browser เปิดไม่ได้ timeout หรือ engine ล้มเหลว จะไม่มีคะแนน แต่ผล HTML ยังอ่านได้
หาก robots.txt บล็อก SEOChecker ยังเคารพกฎนั้น ไม่อ้างว่าตรวจครบ

ผล localhost เป็น lab test ไม่ใช่ข้อมูลผู้ใช้จริง การยืนยัน Google index หรือหลักฐาน
ว่าเว็บไซต์เข้าถึงได้จากอินเทอร์เน็ต คะแนนอาจต่างจาก DevTools เพราะสภาพเครื่อง
และ network policy ของ checker

## Network และการเก็บข้อมูล

- อนุญาต loopback เฉพาะ origin/พอร์ตของ URL ที่ใส่ ไม่อ่านบริการ local พอร์ตอื่นหรือ LAN
- เว็บสาธารณะและ public CDN ยังผ่าน DNS pinning/private-IP checks และพอร์ต 80/443
- ใช้ GET เท่านั้น ไม่ส่ง cookie/auth/header จาก browser ไม่คลิกหรือ login
- บล็อก subframes, popups, workers, service workers, WebSockets และ WebRTC
- จำกัด 90 วินาที, 300 intercepted requests, 4 MiB/resource, allocation รวม 32 MiB
  และ redirect 5 ครั้ง เก็บ network evidence ไม่เกิน 100 รายการพร้อมจำนวนที่ละไว้
- ยกเลิก/F5/ปิดแท็บปิด browser และยุติ socket ก่อนคืนช่องงาน ไม่มีคิวหรือประวัติ
- รายงานอยู่ใน RAM รอบปัจจุบันเท่านั้น ไม่เขียน raw LHR, HTML report, trace หรือ screenshot
  profile ชั่วคราวของ browser ถูกจัดการและล้างเมื่อปิด ไม่ใช่ที่เก็บประวัติรายงาน

หน้า checker ใช้ Bootstrap/Lucide/ExcelJS CDN จึงยังต้องเข้าถึง CDN เพื่อใช้ UI ครบ
Lighthouse อาจร้องขอ public asset ที่เว็บเป้าหมายอ้างถึง ไม่ได้หมายถึงทั้งระบบ offline

กดดาวน์โหลด JSON เพื่อเก็บรายงานต้นฉบับ หรือ XLSX สำหรับนำเข้า Google Sheets เอง
ไฟล์สร้างใน browser เมื่อกดเท่านั้น ไม่มีการอัปโหลดไป Google อัตโนมัติ
ดู [การนำเข้า Google Sheets](GOOGLE-SHEETS.md)

อ้างอิง: [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview),
[การใช้ Lighthouse กับ Puppeteer](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/docs/puppeteer.md)
