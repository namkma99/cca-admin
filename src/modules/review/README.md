# review

API tài liệu ôn tập dạng đọc, dùng ngân hàng CCA đã import vào database. Không tạo câu hỏi/đáp án mới, không sinh đề, không tạo chu kỳ hoặc tiêu tốn lượt thi. Không cần migration mới.

## Xác thực

Dùng cookie phiên hiện có cho cả admin và student; frontend gọi API với `credentials: 'include'`. Kiểm tra giao diện đăng nhập bằng `GET /api/v1/auth/session`: response `{ session: null }` nghĩa là chưa đăng nhập, chỉ `session.kind === 'authenticated'` được đọc tài liệu. Không thêm `/api/auth/me`.

Mỗi request dữ liệu đều kiểm tra phiên và trạng thái tài khoản ở server. Phiên đặt mật khẩu không có quyền đọc. `OPTIONS` chỉ trả preflight CORS, không trả dữ liệu và không yêu cầu đăng nhập.

## Danh sách chủ đề

`GET /api/v1/review/topics`

```json
{
  "topics": [
    { "id": "cca-f", "name": "CCA-F", "questionCount": 1 },
    { "id": "ccao-f", "name": "CCAO-F", "questionCount": 0 },
    { "id": "ccar-p", "name": "CCAR-P", "questionCount": 0 }
  ]
}
```

Số lượng lấy trực tiếp từ database, chỉ đếm câu `ready`. Luôn liệt kê ba chủ đề hiện có, kể cả chủ đề chưa có câu đủ điều kiện.

## Toàn bộ câu hỏi và đáp án

`GET /api/v1/review/topics/{topicId}/questions`

Ví dụ minh họa cấu trúc, không phải dữ liệu ngân hàng thật:

```json
{
  "topicId": "cca-f",
  "total": 1,
  "questions": [
    {
      "id": "example-1",
      "type": "single_choice",
      "prompt": "Câu hỏi minh họa?",
      "choices": [
        { "id": "A", "text": "Lựa chọn A" },
        { "id": "B", "text": "Lựa chọn B" }
      ],
      "correctChoiceIds": ["B"]
    }
  ]
}
```

- Chỉ trả câu `ready`, loại `needs_review` và `disabled`.
- Trả toàn bộ câu theo số thứ tự nguồn; không phân trang, lấy mẫu hay giới hạn theo đề thi.
- `total` luôn bằng `questions.length`. Chủ đề hợp lệ nhưng rỗng trả `200`, `total: 0`, `questions: []`.
- `type`: `single_choice` hoặc `multiple_response`. Đánh dấu đáp án bằng cách đối chiếu `choices[].id` với `correctChoiceIds` (có thể nhiều đáp án đúng).
- Giữ nội dung gốc; không thêm level, giải thích hay `seniorAnswer` vì ngân hàng hiện tại không có các trường này.

## Lỗi và bảo mật

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Vui lòng đăng nhập."
  },
  "requestId": "..."
}
```

- `401 UNAUTHENTICATED`: thiếu/sai cookie, phiên không tồn tại, hết hạn hoặc đã thu hồi.
- `403 FORBIDDEN`: phiên đặt mật khẩu hoặc tài khoản bị khóa khi phiên còn hợp lệ.
- `403 ORIGIN_FORBIDDEN`: origin ngoài danh sách cho phép.
- `404 TOPIC_NOT_FOUND`: chủ đề không tồn tại; chỉ kiểm tra sau xác thực.
- `500 INTERNAL_ERROR`: lỗi hạ tầng/cấu hình; không trả chi tiết nội bộ.
- Mọi response của hai endpoint, kể cả lỗi, có `Cache-Control: private, no-store`.
- Dùng CORS và cookie hiện có: `APP_ORIGIN`, `CCA_ALLOWED_ORIGINS`, origin chính xác, credentials, cookie HttpOnly/Secure trên production, SameSite=Lax. Nếu frontend khác site, cần điều chỉnh mô hình triển khai/cookie; bật CORS riêng không đủ để gửi cookie cross-site.

Frontend đọc response trong bộ nhớ, xóa nội dung khi đăng xuất/hết phiên; không đóng gói ngân hàng đáp án trong JavaScript, public assets hay lưu browser storage. Khi bổ sung xuất JSON, dùng chính API có xác thực này. API thi vẫn giữ DTO không có đáp án.

Thay đổi này chỉ triển khai backend. Tab Ôn tập và việc gỡ dữ liệu công khai trong repo frontend `next-pro` là công việc riêng.
