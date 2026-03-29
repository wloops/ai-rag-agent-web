function parseApiDate(value: string): Date {
  // API timestamps are stored as UTC without an offset, so append Z before parsing.
  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !value.includes("T") ? value : `${value}Z`;

  return new Date(normalizedValue);
}

export function formatDateTime(value: string): string {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: string): string {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatFileType(value: string): string {
  return value.toUpperCase();
}

export function formatDocumentStatus(status: string): string {
  if (status === "success") {
    return "已完成";
  }
  if (status === "pending") {
    return "排队中";
  }
  if (status === "processing") {
    return "处理中";
  }
  if (status === "failed") {
    return "失败";
  }
  return status;
}
