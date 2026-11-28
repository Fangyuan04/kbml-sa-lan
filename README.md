# KBML Cần Giờ

Bản mẫu nghiên cứu của Nhóm 308, ngành Quản lý hàng hải, phục vụ báo cáo học kỳ doanh nghiệp.

## Bản cập nhật

- Chữ lớn, đậm và tương phản rõ; nút thao tác thuận tiện trên điện thoại.
- Hồ sơ phương tiện có mục **Giấy chứng nhận**: mở ngay PDF mô phỏng theo từng phương tiện, phóng to/thu nhỏ, tải file PDF; đồng thời giữ chức năng thêm/sửa thông tin và đính kèm bản chụp riêng.
- Khai báo chuyến, theo dõi hành trình, đối chiếu thông tin và thống kê.
- OCR Việt/Anh chạy trong trình duyệt; giữ nguyên toàn bộ `vendor/ocr/` và giấy phép đi kèm.

## Xuất bản

Bộ tệp này đã sẵn sàng đặt ở gốc trang GitHub Pages. `index.html`, các tệp JavaScript/CSS và thư mục `vendor/` phải nằm cùng cấp như trong bộ mã nguồn. Không cần bước build.

## Chạy trên máy

Từ thư mục chứa `index.html`:

```bash
python3 -m http.server 8080
```

Mở `http://localhost:8080`. Không mở trực tiếp tệp HTML vì ứng dụng sử dụng mô-đun JavaScript và OCR.

## Xem giấy chứng nhận

Vào **Phương tiện → Giấy chứng nhận**, bấm tên giấy hoặc **Xem PDF mô phỏng** để mở ngay trong trang. Có sẵn mẫu đăng ký phương tiện, an toàn kỹ thuật và bảo hiểm; giấy khác đã khai cũng có thể tạo bản mô phỏng. Dùng **+ / −** để phóng to, thu nhỏ, **Mở tệp PDF** để xem riêng và **Tải PDF mô phỏng** để lưu file.

Mỗi PDF được tạo từ dữ liệu hiện tại, có nhãn và watermark **MÔ PHỎNG - KHÔNG CÓ GIÁ TRỊ PHÁP LÝ**. Trường chưa khai vẫn để rõ chưa có thông tin. Mẫu giấy chưa được khai chỉ là lựa chọn xem thử, không tự thêm giấy vào hồ sơ hoặc ghi đè dữ liệu.

Nếu đã đính kèm ảnh/PDF và tệp còn trên thiết bị, bấm tên giấy sẽ ưu tiên bản đã tải lên; vẫn có nút mở PDF mô phỏng riêng. Để thêm hoặc thay bản chụp, chọn **Đính kèm bản chụp**, rồi lưu giấy chứng nhận.

## Dữ liệu và giới hạn

Đây là bản mẫu nghiên cứu, không cấp phép và không thay thế hệ thống nghiệp vụ chính thức. Dữ liệu mẫu là giả lập. Biểu mẫu và tệp đính kèm lưu tại trình duyệt đang sử dụng; chưa đồng bộ giữa các máy hoặc địa chỉ website. Sao lưu JSON không chứa nội dung ảnh/PDF; cần giữ riêng tệp gốc. OCR nhận dạng ảnh, còn PDF chỉ được xem trước.

Mã nguồn bản xuất: `89ffd1e4cd55ea775f912e9cf5ff960931423caa`.
