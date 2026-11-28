# KBML Cần Giờ

Bản mẫu nghiên cứu của Nhóm 308, ngành Quản lý hàng hải, phục vụ báo cáo học kỳ doanh nghiệp.

## Bản cập nhật

- Cỡ chữ cân đối với giao diện: nội dung 16 px, nhãn phụ 14 px, tiêu đề có phân cấp rõ; các nút thao tác vẫn dễ bấm trên điện thoại. Bỏ các dòng chú thích nguồn, banner giải thích lặp lại và chân trang khỏi giao diện thao tác; giữ cảnh báo dữ liệu và thông báo lỗi cần xử lý.
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

Vào **Phương tiện → Giấy chứng nhận**, bấm tên giấy hoặc **Xem PDF mô phỏng** để mở ngay trong trang. Có sẵn mẫu đăng ký phương tiện, an toàn kỹ thuật và bảo hiểm; giấy khác đã khai cũng có thể tạo bản mô phỏng. Khi mở, toàn bộ trang giấy tự căn vừa cả chiều rộng và chiều cao của khung xem, kể cả khi đổi giữa trang ngang và trang dọc. Dùng **+ / −** để phóng to, thu nhỏ; **Vừa toàn trang** để trở lại chế độ xem trọn trang; **Mở tệp PDF** để xem riêng và **Tải PDF** để lưu file. Thay đổi kích thước cửa sổ sẽ tự tính lại khung giấy. Bản PDF do người dùng tải lên dùng chế độ Fit của trình đọc PDF trên trình duyệt nếu được hỗ trợ.

Mỗi PDF được tạo từ dữ liệu hiện tại, có nhãn và watermark **MÔ PHỎNG**. Trường chưa khai vẫn để rõ chưa có thông tin. Mẫu giấy chưa được khai chỉ là lựa chọn xem thử, không tự thêm giấy vào hồ sơ hoặc ghi đè dữ liệu.

### Biểu mẫu theo tài liệu của nhóm

Các mẫu được dựng lại theo bố cục bộ hồ sơ **Tân Cảng 22** trong tài liệu người dùng cung cấp: đăng ký phương tiện (trang 1), bảo hiểm (trang 2), giấy an toàn kỹ thuật và bảo vệ môi trường (trang 5), phụ lục trang thiết bị (trang 4), báo cáo kiểm tra kỹ thuật (trang 3). Mẫu đăng ký có viền hồng, dòng chấm và chữ serif; mẫu bảo hiểm có bảng trách nhiệm/phí; bộ kỹ thuật giữ bố cục hai cột và các trang nằm ngang.

PDF an toàn kỹ thuật gồm **3 trang**: giấy chứng nhận, phụ lục trang thiết bị, báo cáo kiểm tra kỹ thuật. Dùng **Trước / Sau** hoặc danh sách **Trang tài liệu** để chọn trang. Tải PDF sẽ tải toàn bộ các trang trong một tệp, giữ đúng chiều trang.

Chỉ tham chiếu hình thức biểu mẫu. Bản mô phỏng không chép dữ liệu cá nhân, chữ ký hoặc con dấu từ hồ sơ gốc; không tự tạo kết quả kiểm tra, điều khoản bảo hiểm hay số tiền. Trọng tải, dung tích, loại phương tiện và công dụng là các trường khác nhau; thông tin không có trong hồ sơ hiện tại được để rõ chưa khai báo.

Nếu đã đính kèm ảnh/PDF và tệp còn trên thiết bị, bấm tên giấy sẽ ưu tiên bản đã tải lên; vẫn có nút mở PDF mô phỏng riêng. Để thêm hoặc thay bản chụp, chọn **Đính kèm bản chụp**, rồi lưu giấy chứng nhận.

## Dữ liệu và giới hạn

Đây là bản mẫu nghiên cứu, không cấp phép và không thay thế hệ thống nghiệp vụ chính thức. Dữ liệu mẫu là giả lập. Biểu mẫu và tệp đính kèm lưu tại trình duyệt đang sử dụng; chưa đồng bộ giữa các máy hoặc địa chỉ website. Sao lưu JSON không chứa nội dung ảnh/PDF; cần giữ riêng tệp gốc. OCR nhận dạng ảnh, còn PDF chỉ được xem trước.

Mã nguồn bản xuất: `89ffd1e4cd55ea775f912e9cf5ff960931423caa`.
