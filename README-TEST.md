# CDP Tracking Test Server

Đây là một server Node.js đơn giản để kiểm tra hệ thống tracking CDP. Server này nhận các tracking event từ hệ thống CDP và lưu chúng vào file log để bạn có thể xem.

## Cài đặt

1. Cài đặt Node.js (nếu chưa có)
2. Clone repository này
3. Cài đặt các dependency:

```bash
npm install
```

## Chạy server

```bash
npm start
```

Server sẽ chạy ở cổng 3000 (mặc định). Bạn có thể thay đổi cổng bằng cách đặt biến môi trường PORT:

```bash
PORT=8080 npm start
```

## Cấu trúc thư mục

```
├── server.js           # Server Node.js
├── package.json        # Cấu hình npm
├── test.html           # Trang HTML để test tracking
├── client-integration.js # Script tracking cho client
├── cdp-tracker.js      # Script tracking trên CDN
├── tracker-iframe.html # File HTML cho iframe
└── logs/               # Thư mục chứa file log
    ├── view-events.log     # Log các sự kiện view
    ├── action-events.log   # Log các sự kiện action
    ├── conversion-events.log # Log các sự kiện conversion
    ├── feedback-events.log # Log các sự kiện feedback
    ├── profile-updates.log # Log các cập nhật profile
    └── all-events.log      # Log tất cả các sự kiện
```

## Cách sử dụng

### 1. Chạy server

```bash
npm start
```

### 2. Chuẩn bị các file tracking

Đảm bảo rằng các file tracking (`client-integration.js`, `cdp-tracker.js`, `tracker-iframe.html`) đã được đặt trong thư mục gốc của server.

### 3. Mở trang test

Mở file `test.html` trong trình duyệt của bạn. Bạn có thể sử dụng một server HTTP đơn giản để phục vụ file này, hoặc mở trực tiếp từ hệ thống file.

### 4. Cấu hình tracking

Trong trang test, đảm bảo rằng:

- Tracker ID: Một ID duy nhất cho ứng dụng của bạn
- CDN Domain: `localhost:3000` (hoặc cổng bạn đã cấu hình)
- API Domain: `localhost:3000` (hoặc cổng bạn đã cấu hình)

Nhấn "Apply Configuration" để áp dụng cấu hình.

### 5. Test các sự kiện tracking

Nhấn các nút trong trang test để gửi các sự kiện tracking khác nhau:

- View Events: Page View, Content Impression
- Action Events: Button Click, Form Submit
- Conversion Events: Purchase, Signup
- Feedback Events: Rating, Survey Response
- Profile Updates: Update Profile

Bạn cũng có thể tạo và gửi các sự kiện tùy chỉnh.

### 6. Kiểm tra log

Các sự kiện tracking sẽ được log vào console của server và lưu vào các file log trong thư mục `logs/`.

## API Endpoints

Server cung cấp các endpoint sau:

- `GET /`: Dashboard đơn giản
- `GET /status`: Kiểm tra trạng thái server
- `POST /track/view`: Nhận các sự kiện view
- `POST /track/action`: Nhận các sự kiện action
- `POST /track/conversion`: Nhận các sự kiện conversion
- `POST /track/feedback`: Nhận các sự kiện feedback
- `POST /profile/update`: Nhận các cập nhật profile
- `POST /track`: Fallback endpoint cho các sự kiện khác

## Xử lý lỗi

Nếu bạn gặp lỗi khi test tracking:

1. Kiểm tra console của trình duyệt để xem lỗi JavaScript
2. Kiểm tra console của server để xem lỗi server
3. Đảm bảo rằng các file tracking đã được đặt đúng vị trí
4. Đảm bảo rằng cổng server không bị chặn bởi firewall

## Tùy chỉnh

Bạn có thể tùy chỉnh server bằng cách chỉnh sửa file `server.js`. Một số tùy chỉnh phổ biến:

- Thay đổi cổng server
- Thay đổi định dạng log
- Thêm xác thực cho các endpoint
- Thêm xử lý dữ liệu tracking
