# AGENTS.md - MoveSafe VN Agent Configuration

This file provides context and skill bindings for AI coding agents operating in this repository.

## Local Skills Directory: `.agents/skills/` & `.github/skills/`
The repository mounts the following specialized skills:
- `ui-ux-pro-max-skill-2.15.0`: Advanced UI/UX guidelines, color theory, typography, and responsive patterns.
- `frontend-ui-engineering`: Addy Osmani's production-grade frontend engineering, Core Web Vitals & a11y.
- `frontend-design`: Anthropic's visual layout, whitespace rhythm & visual hierarchy.
- `better-ui` & `better-interface`: Jakub Krehel's micro-interactions, WCAG 2.2 accessibility checklist.
- `web-design-guidelines`: Vercel Labs' high-performance web product guidelines.
- `OfficeCLI-1.0.153`: Office document automation (.docx, .xlsx, .pptx).
- `adaptive-feature-tester`: Intent-driven resilient feature testing, adaptive discovery, and self-healing verification.
- `ai-memory`: Persistent cross-session project memory and OKF wiki documentation.
- `reverse-engineer-anything`: Reverse engineering tools for external APIs and bundles.

## Key Project Rules
- **Icon Policy**: Use clean, minimalist SVG line icons (e.g. Lucide/Feather style SVG icons) to make the interface lively and intuitive. Avoid playful/messy emojis.
- **Frontend Stack**: Vanilla JS + CSS3 + Leaflet.js.
- **Backend Stack**: Node.js + Express.

## Mandatory Automation Workflow (Quy Trình Tự Động Bắt Buộc)
- **Tự động kích hoạt Adaptive Feature Testing sau mỗi tính năng**:
  Mỗi khi Agent hoàn thành việc code xong một tính năng mới, sửa lỗi (bugfix) hoặc tái cấu trúc (refactoring):
  1. **BẮT BUỘC** tự động áp dụng skill `adaptive-feature-tester` ngay lập tức mà không cần người dùng phải nhắc.
  2. Thực thi đầy đủ 7 bước kiểm thử: Khám phá ngữ cảnh hiện tại -> Xây dựng kịch bản theo ý định (Intent) -> Định vị phần tử/endpoint đa tín hiệu (2-Signal rule) -> Chờ trạng thái động -> Assert hành vi nghiệp vụ -> Tự sửa kịch bản an toàn (nếu UI/API đổi hợp lệ) -> Xuất báo cáo kiểm thử.
  3. Chỉ được coi là hoàn thành task và bàn giao cho người dùng khi báo cáo kiểm thử đạt trạng thái `PASS` (hoặc nêu rõ bug nếu phát hiện `FAIL`).
