import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="الصفحة غير موجودة"
      action={
        <Link to="/" className="btn-primary">
          العودة للرئيسية
        </Link>
      }
    />
  );
}
