import { createContext, useContext } from 'react';

export type Lang = 'th' | 'en';

const th = {
  appName: 'หอมปรุง Photobooth',
  tagline: 'ใส่รูปของคุณในกรอบหอมปรุง แล้วส่งให้เจ้าหน้าที่พิมพ์เป็นสติกเกอร์ให้คุณ',
  choosePhoto: 'เลือกรูป / ถ่ายรูป',
  openCamera: 'เปิดกล้องถ่ายรูป',
  privacyNote:
    'รูปจะถูกส่งให้เจ้าหน้าที่ใช้พิมพ์สติกเกอร์ในรอบนี้เท่านั้น และจะถูกลบอัตโนมัติเมื่อจบรอบ (ภายใน 1 ชั่วโมง)',
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
  frameText: 'ข้อความบนกรอบ (ไม่บังคับ)',
  frameTextPlaceholder: 'เช่น ชื่อของคุณ',
  frameTextHint: 'ข้อความจะโค้งอยู่ด้านล่างของกรอบ',
  frameTextUnavailable: 'กรอบนี้มีข้อความอยู่แล้ว เลือกกรอบที่มีป้าย Aa เพื่อใส่ข้อความของคุณ',
  frameTextClear: 'ลบข้อความ',
  frameTextBadge: 'ใส่ข้อความได้',
  changePhoto: 'เปลี่ยนรูป',
  reset: 'รีเซ็ต',
  download: 'บันทึกรูปลงเครื่อง',
  yourName: 'ชื่อของคุณ',
  yourNameHint: 'เพื่อให้เจ้าหน้าที่ส่งสติกเกอร์ให้ถูกคน',
  yourNamePlaceholder: 'เช่น มะลิ',
  send: 'ส่งให้เจ้าหน้าที่พิมพ์',
  resend: 'ส่งรูปใหม่แทนรูปเดิม',
  sending: 'กำลังส่ง…',
  sendError: 'ส่งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
  sendFull: 'รอบนี้รับรูปครบจำนวนแล้ว กรุณาติดต่อเจ้าหน้าที่',
  sentTitle: 'ส่งเรียบร้อยแล้ว!',
  sentText: 'เจ้าหน้าที่จะพิมพ์สติกเกอร์ให้คุณ รอรับได้เลย',
  editAndResend: 'แก้ไขแล้วส่งใหม่',
  nextPerson: 'ส่งอีกรูป (คนถัดไป)',
  confirmNextPerson: 'เริ่มรูปใหม่สำหรับคนถัดไป? รูปที่ส่งแล้วจะยังอยู่กับเจ้าหน้าที่',
  noClassTitle: 'สแกน QR โค้ดจากเจ้าหน้าที่เพื่อเริ่ม',
  noClassText: 'แอปนี้ใช้ได้ระหว่างเวิร์กช็อป เจ้าหน้าที่จะแสดง QR โค้ดของรอบนั้นให้สแกน',
  closedTitle: 'รอบนี้ปิดรับรูปแล้ว',
  closedText: 'หากยังไม่ได้ส่งรูป กรุณาแจ้งเจ้าหน้าที่เพื่อสแกน QR โค้ดของรอบใหม่',
  offlineTitle: 'เชื่อมต่อไม่ได้',
  offlineText: 'ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  expiredTitle: 'หมดเวลา 1 ชั่วโมงของรอบนี้แล้ว',
  expiredText: 'เพื่อความเป็นส่วนตัว รูปและงานที่แก้ไขถูกลบออกแล้ว',
  exportError: 'สร้างไฟล์ไม่สำเร็จ ลองอีกครั้ง',
  langToggle: 'EN',
  langToggleLabel: 'Switch to English',
  toDark: 'เปลี่ยนเป็นโหมดมืด',
  toLight: 'เปลี่ยนเป็นโหมดสว่าง',
};

type Strings = typeof th;

const en: Strings = {
  appName: 'Homprung Photobooth',
  tagline: 'Put your photo in a Homprung frame and send it to our staff to print as your sticker.',
  choosePhoto: 'Choose / take a photo',
  openCamera: 'Open camera',
  privacyNote:
    "Your photo is sent to our staff only to print this class's stickers, and is deleted automatically when the class ends (within 1 hour).",
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
  frameText: 'Text on the frame (optional)',
  frameTextPlaceholder: 'e.g. your name',
  frameTextHint: 'Your text curves along the bottom of the frame',
  frameTextUnavailable: 'This frame already has text. Pick a frame marked Aa to add your own.',
  frameTextClear: 'Clear text',
  frameTextBadge: 'Text allowed',
  changePhoto: 'Change photo',
  reset: 'Reset',
  download: 'Save to my phone',
  yourName: 'Your name',
  yourNameHint: 'So our staff can hand your sticker to the right person',
  yourNamePlaceholder: 'e.g. Mali',
  send: 'Send to staff for printing',
  resend: 'Send again (replace my photo)',
  sending: 'Sending…',
  sendError: 'Could not send. Check your internet connection and try again.',
  sendFull: 'This class has reached its photo limit. Please ask our staff.',
  sentTitle: 'Sent!',
  sentText: 'Our staff will print your sticker. Please collect it from them.',
  editAndResend: 'Edit and send again',
  nextPerson: 'Send another photo (next person)',
  confirmNextPerson: 'Start a new photo for the next person? The photo you sent stays with our staff.',
  noClassTitle: 'Scan the QR code from our staff to start',
  noClassText: 'This app works during a workshop. Our staff will show the QR code for your class.',
  closedTitle: 'This class is no longer accepting photos',
  closedText: "If you haven't sent your photo yet, ask our staff for the new class's QR code.",
  offlineTitle: "Can't connect",
  offlineText: 'Check your internet connection and try again.',
  retry: 'Try again',
  expiredTitle: "This class's 1 hour is over",
  expiredText: 'For your privacy, the photo and edits have been deleted.',
  exportError: 'Could not create the file. Please try again.',
  langToggle: 'ไทย',
  langToggleLabel: 'เปลี่ยนเป็นภาษาไทย',
  toDark: 'Switch to dark mode',
  toLight: 'Switch to light mode',
};

export const STRINGS: Record<Lang, Strings> = { th, en };

/** Display preferences for components: strings, language and theme. */
export interface I18nValue {
  t: Strings;
  lang: Lang;
  toggle: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const I18nContext = createContext<I18nValue>({
  t: th,
  lang: 'th',
  toggle: () => {},
  theme: 'light',
  toggleTheme: () => {},
});

export const useI18n = () => useContext(I18nContext);
