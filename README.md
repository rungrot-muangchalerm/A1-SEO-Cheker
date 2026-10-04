# SEO Checker

โครง Express + EJS ตาม [DevTeam EJS Framework](https://github.com/rungrot-muangchalerm/A0-DevTeam-EJS-FrameWork) อ้างอิง commit `40ff998` โดยปรับให้ไม่มีฐานข้อมูล ระบบล็อกอิน cookies หรือการเก็บผลตรวจ

## เริ่มใช้งาน

ใช้ Node.js 22 ขึ้นไป และรันคำสั่งในโฟลเดอร์โปรเจกต์:

```sh
npm install
npm start
```

เปิด `http://127.0.0.1:3000` ใช้ `npm run dev` เมื่อต้องการให้ Node.js watch mode เริ่มเซิร์ฟเวอร์ใหม่หลังแก้ไฟล์

ค่าตั้งต้นอยู่ใน `example.env` และไม่ต้องมี `.env` เพื่อรัน หากเปลี่ยนพอร์ต ให้ตั้ง `PORT` ผ่าน environment หรือไฟล์ `.env` ซึ่งไม่เข้า Git

## โครงสร้าง

```text
index.js                         สร้าง Express app และเริ่มเซิร์ฟเวอร์
app/config/                      ค่าตั้งระบบ
app/routes/router.js             router กลางและ 404
app/routes/frontend/             เส้นทางหน้า EJS
app/routes/api/                  เส้นทาง JSON API
app/controller/                  รับ request และกำหนด response
app/service/                     ประสานการตรวจและกฎ SEO
app/data/                        ดึงข้อมูลเว็บไซต์ภายนอก ไม่ใช่ฐานข้อมูล
app/model/                       รูปแบบรายงานในหน่วยความจำ
app/middleware/                  headers และ error handling
app/function/                    helper ที่ใช้ร่วมกัน
views/layouts/                   โครง HTML และ Bootstrap CDN
views/page/                      หน้าจอ SEO Checker
views/components/                ส่วนแสดงผลที่ใช้ซ้ำเมื่อจำเป็น
assets/js/app.js                 UI แบบ CSR
test/                            ทดสอบด้วย Node.js test runner
TODO.md                          งานที่ทำต่อทีละข้อ
```

ตอนนี้ผลใน UI ยังเป็น mockup ไม่มีการตรวจ URL จริง กด F5 แล้วเริ่มรอบใหม่ ไม่มีการบันทึกอัตโนมัติ ดาวน์โหลด CSV เมื่อกดปุ่มเองเท่านั้น

## ตรวจสอบ

```sh
npm test
npm run check
```
