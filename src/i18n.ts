import { createContext, useContext } from 'react';

export type Lang = 'th' | 'en';

const th = {
  appName: 'หอมปรุง Photobooth',
  tagline: 'ใส่รูปของคุณในกรอบหอมปรุง แล้วพิมพ์เป็นสติกเกอร์วงกลม 3 ซม.',
  choosePhoto: 'เลือกรูป / ถ่ายรูป',
  openCamera: 'เปิดกล้องถ่ายรูป',
  privacyNote:
    'รูปของคุณอยู่ในเครื่องนี้เท่านั้น ไม่มีการอัปโหลด ไม่มีการเก็บข้อมูล และจะถูกลบอัตโนมัติภายใน 1 ชั่วโมง',
  workshop: 'เวิร์กช็อป',
  loadingPhoto: 'กำลังเตรียมรูป…',
  loadPhotoError: 'เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่น (JPG / PNG)',
  timeLeft: (m: number) => `เหลือเวลา ${m} นาที`,
  dragHint: 'ลากเพื่อเลื่อนรูป · ถ่างนิ้วหรือใช้แถบเพื่อซูม',
  zoom: 'ซูม',
  rotate: 'หมุน 90°',
  chooseFrame: 'เลือกกรอบ',
  noFrame: 'ไม่มีกรอบ',
  framesError: 'โหลดกรอบไม่สำเร็จ',
  changePhoto: 'เปลี่ยนรูป',
  reset: 'รีเซ็ต',
  download: 'ดาวน์โหลด',
  print: 'พิมพ์',
  stickerSheet: 'พิมพ์แผ่นสติกเกอร์ A4',
  stickerCount: 'จำนวนดวง',
  printTip: 'พิมพ์ที่ขนาดจริง 100% (ไม่ย่อ/ขยาย)',
  printTipLong: 'ในหน้าต่างพิมพ์ ให้ตั้งค่า Scale เป็น 100% / Actual size และปิด "Fit to page"',
  done: 'เสร็จแล้ว',
  doneTitle: 'ขอบคุณที่ร่วมสนุกกับหอมปรุง',
  doneText: 'บันทึกรูปหรือพิมพ์ซ้ำได้จนกว่าจะหมดเวลา',
  backToEdit: 'กลับไปแก้ไข',
  startOver: 'เริ่มใหม่',
  expiredTitle: 'หมดเวลา 1 ชั่วโมง กรุณาเริ่มใหม่',
  expiredText: 'เพื่อความเป็นส่วนตัว รูปและงานที่แก้ไขถูกลบออกจากเครื่องนี้แล้ว',
  confirmStartOver: 'ลบรูปและเริ่มใหม่?',
  exportError: 'สร้างไฟล์ไม่สำเร็จ ลองอีกครั้ง',
  langToggle: 'EN',
};

type Strings = typeof th;

const en: Strings = {
  appName: 'Homprung Photobooth',
  tagline: 'Put your photo in a Homprung frame and print it as a 3 cm round sticker.',
  choosePhoto: 'Choose / take a photo',
  openCamera: 'Open camera',
  privacyNote:
    'Your photo stays on this device. Nothing is uploaded or stored, and everything is wiped automatically within 1 hour.',
  workshop: 'Workshop',
  loadingPhoto: 'Preparing photo…',
  loadPhotoError: 'Could not open this image. Please try another one (JPG / PNG).',
  timeLeft: (m: number) => `${m} min left`,
  dragHint: 'Drag to move · pinch or use the slider to zoom',
  zoom: 'Zoom',
  rotate: 'Rotate 90°',
  chooseFrame: 'Choose a frame',
  noFrame: 'No frame',
  framesError: 'Could not load frames',
  changePhoto: 'Change photo',
  reset: 'Reset',
  download: 'Download',
  print: 'Print',
  stickerSheet: 'Print A4 sticker sheet',
  stickerCount: 'Stickers',
  printTip: 'Print at actual size 100% (no scaling)',
  printTipLong: 'In the print dialog set Scale to 100% / Actual size and turn off "Fit to page".',
  done: 'Done',
  doneTitle: 'Thank you for joining Homprung!',
  doneText: 'You can save or print again until the session expires.',
  backToEdit: 'Back to editor',
  startOver: 'Start over',
  expiredTitle: 'The 1-hour session has ended. Please start over.',
  expiredText: 'For your privacy, the photo and edits were removed from this device.',
  confirmStartOver: 'Delete the photo and start over?',
  exportError: 'Could not create the file. Please try again.',
  langToggle: 'ไทย',
};

export const STRINGS: Record<Lang, Strings> = { th, en };

export const I18nContext = createContext<{ t: Strings; lang: Lang; toggle: () => void }>({
  t: th,
  lang: 'th',
  toggle: () => {},
});

export const useI18n = () => useContext(I18nContext);
