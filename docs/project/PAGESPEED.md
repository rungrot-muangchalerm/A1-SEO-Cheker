# PageSpeed Insights Setup

คะแนนมาจาก Lighthouse ของ Google ผ่าน PageSpeed Insights ไม่ใช่คะแนนที่ checker คำนวณเอง
ขอ `performance`, `accessibility`, `best-practices`, `seo` ทุกครั้ง เพราะ API ตรวจเฉพาะ Performance ถ้าไม่ระบุหมวด
ดู [API reference](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed)

## ตั้งค่า Key

1. เลือกหรือสร้าง project ใน [Google Cloud Console](https://console.cloud.google.com/)
2. เปิดใช้ **PageSpeed Insights API** (`pagespeedonline.googleapis.com`) ใน APIs & Services > Library
3. ไป APIs & Services > Credentials > Create credentials > API key
4. จำกัด API restrictions ให้ใช้เฉพาะ PageSpeed Insights API และจำกัด IP ฝั่ง server ถ้ามี outbound IP คงที่ ไม่ใช้ HTTP referrer restrictions กับการเรียกจาก backend
5. เติมค่า `PAGESPEED_API_KEY` ใน `.env` ของเครื่อง/server โดยไม่ส่ง key ในแชต ไม่ commit `.env` และไม่ใส่ในไฟล์ `assets/` หรือ EJS
6. Restart server แล้วเลือก PageSpeed Insights ก่อนกดตรวจ

```dotenv
PAGESPEED_API_KEY=YOUR_SERVER_SIDE_KEY
```

ขั้นตอน key อ้างอิง [Google getting started](https://developers.google.com/speed/docs/insights/v5/get-started)
และ [API key security](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
API รองรับการเรียกโดยไม่ใส่ key ด้วย แต่โปรเจกต์นี้ตั้งใจไม่ส่งคำขออัตโนมัติเมื่อ key ว่าง
เพื่อให้เจ้าของระบบควบคุมการเปิดใช้และ quota ได้ ยังตรวจ HTML/crawl/JavaScript ได้ตามปกติ

## ขอบเขตและข้อมูล

- ปิดเป็นค่าเริ่มต้น ต้องเลือกก่อนส่ง URL ไป Google; ไม่ควรใช้กับ URL ที่มีข้อมูลลับใน query
- เลือก mobile (ค่าเริ่มต้น) หรือ desktop ส่งตรวจหนึ่ง URL ต่อรอบ แม้จะเลือก crawl หลายหน้า ไม่เฉลี่ยเป็นคะแนนโดเมน
- รายงานแยกโหมดที่ขอตรวจกับ form factor/throttling ที่ provider ส่งกลับมา พร้อม URL เริ่มต้น/สุดท้าย fetchTime และรุ่น Lighthouse/browser; ข้อมูลที่ไม่ส่งกลับแสดงว่าไม่มีข้อมูล
- จำกัดคำขอ 90 วินาทีและ JSON 8 MiB ทั้งข้อมูลรับและข้อมูลหลังคลาย compression; ไม่ตาม redirect ของ API
- API อยู่ที่ endpoint คงที่ HTTPS และตรวจ/pin DNS ของ provider ไม่รับ endpoint/key จาก request body
- ไม่มี key: `not-configured`; ไม่มีคะแนน: `not-checked`; คะแนนบางหมวดหาย: `partial` ไม่มีคะแนนสำรอง
- ไม่ส่งต่อ raw provider errors, screenshots, HTML, key หรือ full Lighthouse response เข้า frontend/log
- ไม่เก็บรายงานหรือ cache ใน checker; F5 ล้างรอบปัจจุบัน การยกเลิกตัดคำขอจาก server แต่ไม่รับประกันว่า Google จะหยุดงานภายในของเขา
- Google เป็นบริการภายนอก นโยบายการเก็บข้อมูลของ checker ไม่ใช่คำรับประกันนโยบายของ Google
- เวลาตรวจ/รุ่น engine ที่ provider ไม่ส่งให้ถือว่าไม่มีข้อมูล ไม่ใช้เวลาหรือรุ่น browser ของ checker แทน

## Agentic Browsing

ใช้ผลจาก provider เท่านั้น ไม่ใช้รุ่น Chrome ที่ติดตั้งในเครื่อง checker ยืนยัน Chrome 150+ พร้อมรุ่น Lighthouse และหมวด `agentic-browsing` ที่ประกาศ `fraction` ก่อนนับ auditRefs จริง
นับผ่านตามเกณฑ์ Lighthouse (`score >= 0.9`); error นับว่าไม่ผ่าน ส่วน manual/notApplicable/hidden ไม่เข้าตัวหาร และ informative แยกนับ ไม่มีคะแนน 100 หรือ fallback 1/2
ถ้าหลักฐานหาย ซ้ำ เกินลิมิต หรือไม่รองรับ จะไม่แสดงสัดส่วนผ่าน
PageSpeed API ปัจจุบันรับชื่อหมวดเพียงสี่หมวด จึงไม่ส่งชื่อ Agentic ที่ API ยังไม่รองรับ ถ้า provider ไม่คืนหมวดนี้จะแจ้ง `not-returned-by-provider` ไม่อ้างว่า engine เก่า
ดู [Chrome scoring](https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring) และ [Lighthouse fraction implementation](https://github.com/GoogleChrome/lighthouse/blob/main/report/renderer/report-utils.js)

## การตรวจสอบที่ยังต้องทำ

ทดสอบ contract, network limits, failure และ UI ด้วย fixture ได้โดยไม่ใช้ key จริง
ยังต้องตั้ง key แล้วทดลองกับเว็บไซต์สาธารณะเพื่อยืนยันสิทธิ์ quota และผลคะแนนจริงของ project นี้
ห้ามถือว่าคะแนนจาก fixture เป็นหลักฐานว่าการเรียก Google สำเร็จแล้ว
