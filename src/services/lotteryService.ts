import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export interface ScanResult {
  station: string;
  date: string;
  ticketNumber: string;
  series?: string;
  region: LotteryRegion;
  status: 'Đang chờ kết quả' | 'Đã có kết quả';
  resultMessage: string; // "Trúng giải Tám", "Không trúng", etc.
  prizeAmount: number;
  taxAmount: number;
  netAmount: number;
  isWinner: boolean;
  matchDetails: string;
  lotteryResults?: any; // The actual results used for comparison
}

export type LotteryRegion = 'MN' | 'MT' | 'MB';

export class LotteryService {
  private ai: GoogleGenAI;
  private resultsCache: Map<string, any> = new Map();

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async scanTicket(base64Image: string, region: LotteryRegion): Promise<ScanResult> {
    // Extract mimeType and base64 data from data URL
    const mimeTypeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

    const today = new Date().toLocaleDateString('vi-VN');

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
            {
              text: `Bạn là một chuyên gia phân tích vé xổ số kiến thiết Việt Nam (3 miền: Bắc, Trung, Nam) trong dịp Tết Nguyên Đán 2026. 
Nhiệm vụ của bạn là trích xuất thông tin từ ảnh vé số và đối chiếu với kết quả xổ số thực tế để xác định trúng thưởng.
Hãy luôn phản hồi với thái độ niềm nở, chúc mừng năm mới nếu người dùng trúng thưởng.

### QUY TRÌNH THỰC HIỆN:
1. **Trích xuất dữ liệu (OCR)**:
   - Đài/Tỉnh: (Ví dụ: TP.HCM, Vĩnh Long, Miền Bắc...)
   - Ngày mở thưởng: (Ví dụ: 26/02/2026)
   - Dãy số vé: (6 chữ số với MN/MT, 5 chữ số với Miền Bắc)
   - Ký hiệu (Series): Đặc biệt quan trọng với giải Đặc biệt miền Bắc.
2. **Tra cứu kết quả**: Sử dụng Google Search để tìm kết quả xổ số của Đài và Ngày tương ứng.
3. **Đối chiếu & Tính giải**:
   - **Miền Nam & Miền Trung (Vé 6 số)**:
     + Đặc biệt: Trúng cả 6 số. (2 Tỷ VNĐ)
     + Giải Nhất: Trúng 5 số cuối. (30 Triệu VNĐ)
     + Giải Nhì: Trúng 5 số cuối. (15 Triệu VNĐ)
     + Giải Ba: Trúng 5 số cuối. (10 Triệu VNĐ)
     + Giải Bốn: Trúng 5 số cuối. (3 Triệu VNĐ)
     + Giải Năm: Trúng 4 số cuối. (1 Triệu VNĐ)
     + Giải Sáu: Trúng 4 số cuối. (400.000 VNĐ)
     + Giải Bảy: Trúng 3 số cuối. (200.000 VNĐ)
     + Giải Tám: Trúng 2 số cuối. (100.000 VNĐ)
     + Phụ Đặc biệt: Trúng 5 số cuối của GĐB theo thứ tự. (50 Triệu VNĐ)
     + Khuyến khích: Sai 1 số so với GĐB (trừ chữ số hàng trăm ngàn). (6 Triệu VNĐ)
   - **Miền Bắc (Vé 5 số)**:
     + Đặc biệt: Trúng 5 số + Trùng ký hiệu.
     + Giải Nhất: Trúng 5 số cuối.
     + Giải Nhì: Trúng 5 số cuối.
     + Giải Ba: Trúng 5 số cuối.
     + Giải Bốn: Trúng 4 số cuối.
     + Giải Năm: Trúng 4 số cuối.
     + Giải Sáu: Trúng 3 số cuối.
     + Giải Bảy: Trúng 2 số cuối.
4. **Tính Thuế**: Nếu giải thưởng > 10.000.000 VNĐ, thuế TNCN là 10% của phần vượt quá 10 triệu.

### LƯU Ý OCR:
- Chụp ảnh rõ nét, không lóa đèn.
- Nếu không chắc chắn về con số nào (mờ, lóa), hãy đặt giá trị đó là "?" và yêu cầu người dùng xác nhận trong phần matchDetails.

### DỮ LIỆU THỜI GIAN THỰC:
- Hôm nay là ngày ${today}.

### YÊU CẦU ĐẦU RA (JSON DUY NHẤT):
{
  "station": "string",
  "date": "string",
  "ticketNumber": "string",
  "series": "string | null",
  "region": "MN" | "MT" | "MB",
  "status": "Đang chờ kết quả" | "Đã có kết quả",
  "resultMessage": "string (Ví dụ: Chúc mừng! Bạn đã trúng giải Tám / Không trúng. Chúc bạn may mắn lần sau!)",
  "prizeAmount": number,
  "taxAmount": number,
  "netAmount": number,
  "isWinner": boolean,
  "matchDetails": "string (Giải thích chi tiết cách đối chiếu)",
  "lotteryResults": object | null (Bảng kết quả tra cứu được)
}`,
            },
          ],
        },
        config: {
          temperature: 0,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          tools: [{ googleSearch: {} }]
        },
      });

      let text = response.text || "{}";
      text = text.replace(/```json\n?/, "").replace(/```/, "").trim();
      return JSON.parse(text);
    } catch (e) {
      console.error("Scan Ticket Error:", e);
      throw new Error("Không thể phân tích vé số. Vui lòng đảm bảo ảnh rõ nét và đủ ánh sáng.");
    }
  }

  async fetchLatestResults(region: LotteryRegion, station?: string): Promise<any> {
    const now = new Date();
    const today = now.toLocaleDateString('vi-VN');
    const currentTime = now.toLocaleTimeString('vi-VN');
    const regionName = region === 'MN' ? 'Miền Nam' : region === 'MT' ? 'Miền Trung' : 'Miền Bắc';
    const stationQuery = station ? `đài ${station}` : `xổ số ${regionName}`;
    const cacheKey = `${station || regionName}-${today}`;

    if (this.resultsCache.has(cacheKey)) {
      return this.resultsCache.get(cacheKey);
    }
    
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Hôm nay là ngày ${today}, bây giờ là ${currentTime}. 
      Hãy tìm kết quả xổ số kiến thiết ${stationQuery} MỚI NHẤT có thể. 
      Trả về JSON chính xác theo cấu trúc: 
      { 
        "station": "Tên đài", 
        "date": "Ngày tháng năm (dd/mm/yyyy)", 
        "prizes": { 
          "DB": ["..."], "G1": ["..."], "G2": ["..."], "G3": ["..."], 
          "G4": ["..."], "G5": ["..."], "G6": ["..."], "G7": ["..."], "G8": ["..."] 
        } 
      }`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    try {
        const data = JSON.parse(response.text || "{}");
        if (data && data.prizes) {
          this.resultsCache.set(cacheKey, data);
        }
        return data;
    } catch (e) {
        console.error("Failed to parse results", response.text);
        return null;
    }
  }
}
