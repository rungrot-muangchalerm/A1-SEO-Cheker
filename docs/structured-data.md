# ตัวตรวจ Structured Data

ตรวจ JSON-LD ที่อ่านได้จากหน้าเว็บ และรวมข้อที่ต้องแก้/ตรวจยืนยันในรายการปัญหา พร้อมตำแหน่งบล็อก เหตุผล วิธีแก้ ตัวอย่าง JSON และลิงก์อ้างอิง ตัวอย่างต้องแทนด้วยข้อมูลจริง ไม่ใช่ข้อมูลที่ตรวจพบ

กฎทบทวนวันที่ 2026-10-17:

- Article, NewsArticle, BlogPosting: headline, image, author และวันที่เป็นข้อมูลแนะนำ ไม่มีช่องบังคับตามคู่มือ Article ตรวจรูปแบบวันที่ URL และข้อมูลผู้เขียนที่ระบุได้
- Organization: แนะนำ name, url, logo ไม่มีการสร้างข้อบังคับที่ Google ไม่ได้กำหนด
- Product: กฎ Product snippets ตรวจ name และอย่างน้อยหนึ่งใน offers/review/aggregateRating; Offer ตรวจราคา (รวม priceSpecification), แนะนำสกุลเงิน; AggregateOffer ตรวจ lowPrice และสกุลเงิน ไม่ใช่ตัวตรวจ Merchant listings ทั้งหมด
- BreadcrumbList: ListItem อย่างน้อยสองรายการ ตรวจชื่อ ลำดับ และ URL โดยรายการสุดท้ายไม่บังคับ item

รองรับ @graph, อาร์เรย์ และ @id ที่แก้ได้ภายในบล็อกเดียวกัน ไม่โหลด remote context; context แบบกำหนดเอง ชนิดที่ยังไม่รองรับ และข้อมูลอ้างอิงที่แก้ไม่ได้จะแสดงข้อจำกัด ไม่สรุปว่าผ่าน กฎรีวิว/คะแนนรีวิวยังต้องตรวจต่อด้วย Rich Results Test

มีขีดจำกัดขนาด ความลึก จำนวนโหนด และผลตรวจต่อบล็อก ความถูกต้องของเนื้อหา ราคา รูป ผู้เขียน และนโยบายคุณภาพยังต้องตรวจยืนยันกับสิ่งที่ผู้ใช้เห็น ไม่รับรองสิทธิ์แสดง rich results และไม่ประเมิน Microdata/RDFa ในรุ่นนี้

## แหล่งกฎ

- https://developers.google.com/search/docs/appearance/structured-data/article
- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- https://search.google.com/test/rich-results
