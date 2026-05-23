"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type ICategoryPayload,
  type ITransactionCategory,
} from "@/lib/admin-api";

const icons = [
  "🍔",
  "🥦",
  "🙏",
  "🎮",
  "💡",
  "✍️",
  "🧹",
  "🏠",
  "⚽",
  "🚗",
  "💊",
  "🔧",
  "🎁",
  "🍕",
  "🌮",
  "🍼",
  "🛒",
  "🚌",
  "✈️",
  "🎓",
  "👕",
  "👖",
  "👗",
  "💼",
  "💻",
  "📱",
  "📚",
  "☕",
  "🍎",
  "🚀",
  "💰",
  "🏦",
  "📈",
  "🧾",
  "🏷️",
];

const initialForm: ICategoryPayload = {
  type: "PENGELUARAN",
  name: "",
  icon: "🍔",
  description: "",
  isActive: true,
  budgetEnabled: false,
  budgetAmount: 0,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);

export function CategoriesManager() {
  const [categories, setCategories] = useState<ITransactionCategory[]>([]);
  const [form, setForm] = useState<ICategoryPayload>(initialForm);
  const [editingCategory, setEditingCategory] =
    useState<ITransactionCategory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const result = await getCategories();
      setCategories(result.items);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal memuat kategori.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm(initialForm);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (category: ITransactionCategory) => {
    setEditingCategory(category);
    setForm({
      type: category.type,
      name: category.name,
      icon: category.icon,
      description: category.description ?? "",
      isActive: Boolean(category.is_active),
      budgetEnabled: Boolean(category.budget_enabled),
      budgetAmount: category.budget_amount,
    });
    setError(null);
    setModalOpen(true);
  };

  const saveCategory = async () => {
    if (!form.name.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        budgetAmount: form.budgetEnabled ? Number(form.budgetAmount) || 0 : 0,
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
      } else {
        await createCategory(payload);
      }

      setModalOpen(false);
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal menyimpan kategori.",
      );
    } finally {
      setLoading(false);
    }
  };

  const removeCategory = async (category: ITransactionCategory) => {
    const confirmed = window.confirm(
      `Hapus kategori ${category.name}? Transaksi lama tetap menyimpan nama kategori ini.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await deleteCategory(category.id);
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal menghapus kategori.",
      );
    } finally {
      setLoading(false);
    }
  };

  const expenseCategories = categories.filter(
    (category) => category.type === "PENGELUARAN",
  );
  const incomeCategories = categories.filter(
    (category) => category.type === "PEMASUKAN",
  );

  return (
    <>
      <PageHeader
        description="Kelola kategori transaksi untuk membantu AI dan dashboard mengelompokkan pemasukan serta pengeluaran dengan konsisten."
        eyebrow="Finance Taxonomy"
        title="Categories"
        action={
          <button
            className="category-add-button"
            disabled={loading}
            onClick={openCreateModal}
            type="button"
          >
            <span aria-hidden="true">+</span>
            Tambah Kategori
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <CategorySection
        categories={incomeCategories}
        emptyText="Belum ada kategori pemasukan."
        onDelete={removeCategory}
        onEdit={openEditModal}
        title="Pemasukan"
      />
      <CategorySection
        categories={expenseCategories}
        emptyText="Belum ada kategori pengeluaran."
        onDelete={removeCategory}
        onEdit={openEditModal}
        title="Pengeluaran"
      />

      {modalOpen ? (
        <CategoryModal
          form={form}
          loading={loading}
          mode={editingCategory ? "edit" : "create"}
          onChange={setForm}
          onClose={() => setModalOpen(false)}
          onSave={saveCategory}
        />
      ) : null}
    </>
  );
}

function CategorySection({
  categories,
  emptyText,
  onDelete,
  onEdit,
  title,
}: {
  categories: ITransactionCategory[];
  emptyText: string;
  onDelete: (category: ITransactionCategory) => void;
  onEdit: (category: ITransactionCategory) => void;
  title: string;
}) {
  return (
    <section className="category-section">
      <div className="category-section__header">
        <h2>
          {title} ({categories.length})
        </h2>
      </div>
      {categories.length ? (
        <div className="category-grid">
          {categories.map((category) => (
            <CategoryCard
              category={category}
              key={category.id}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        <div className="category-empty">{emptyText}</div>
      )}
    </section>
  );
}

function CategoryCard({
  category,
  onDelete,
  onEdit,
}: {
  category: ITransactionCategory;
  onDelete: (category: ITransactionCategory) => void;
  onEdit: (category: ITransactionCategory) => void;
}) {
  return (
    <article className="category-card">
      <div className="category-card__top">
        <button
          className="category-card__main"
          onClick={() => onEdit(category)}
          type="button"
        >
          <span className="category-icon">{category.icon}</span>
          <span>
            <strong>{category.name}</strong>
            <StatusBadge tone={category.is_active ? "success" : "warning"}>
              {category.is_active ? "Aktif" : "Diarsipkan"}
            </StatusBadge>
          </span>
        </button>
        <button
          aria-label={`Hapus kategori ${category.name}`}
          className="category-delete"
          onClick={() => onDelete(category)}
          type="button"
        >
          ×
        </button>
      </div>
      <div className="category-card__description">
        {category.description || "Tidak ada deskripsi."}
      </div>
      <div className="category-card__usage">
        <span>
          Terpakai Bulan Ini
          <strong>{formatCurrency(category.usage_this_month)}</strong>
        </span>
        <span className="category-limit">
          {category.budget_enabled
            ? formatCurrency(category.budget_amount)
            : "∞ No Limit"}
        </span>
      </div>
      <div className="category-card__meta">
        {category.transaction_count_this_month} transaksi bulan ini
      </div>
    </article>
  );
}

function CategoryModal({
  form,
  loading,
  mode,
  onChange,
  onClose,
  onSave,
}: {
  form: ICategoryPayload;
  loading: boolean;
  mode: "create" | "edit";
  onChange: (form: ICategoryPayload) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const update = <K extends keyof ICategoryPayload>(
    key: K,
    value: ICategoryPayload[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="category-modal-title"
        aria-modal="true"
        className="category-modal"
        role="dialog"
      >
        <div className="category-modal__header">
          <h2 id="category-modal-title">
            {mode === "create" ? "Tambah Kategori" : "Edit Kategori"}
          </h2>
          <button aria-label="Tutup modal" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div
          className="category-type-toggle"
          role="group"
          aria-label="Tipe kategori"
        >
          <button
            className={form.type === "PENGELUARAN" ? "is-active" : ""}
            onClick={() => update("type", "PENGELUARAN")}
            type="button"
          >
            Pengeluaran
          </button>
          <button
            className={form.type === "PEMASUKAN" ? "is-active" : ""}
            onClick={() => update("type", "PEMASUKAN")}
            type="button"
          >
            Pemasukan
          </button>
        </div>

        <label className="category-field">
          <span>Nama Kategori</span>
          <div className="category-name-row">
            <span className="category-icon category-icon--selected">
              {form.icon}
            </span>
            <input
              className="input"
              onChange={(event) => update("name", event.target.value)}
              placeholder="Nama kategori..."
              value={form.name}
            />
            <span className="category-active-label">Aktif</span>
            <input
              checked={form.isActive}
              className="category-switch"
              onChange={(event) => update("isActive", event.target.checked)}
              type="checkbox"
            />
          </div>
        </label>

        <div className="category-field">
          <span>Ganti Ikon</span>
          <div className="category-icon-grid">
            {icons.map((icon) => (
              <button
                className={form.icon === icon ? "is-active" : ""}
                key={icon}
                onClick={() => update("icon", icon)}
                type="button"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <label className="category-field">
          <span>Deskripsi</span>
          <textarea
            className="textarea"
            onChange={(event) => update("description", event.target.value)}
            placeholder="Tambahkan deskripsi agar AI bisa memahami jenis transaksi kategori ini."
            value={form.description}
          />
        </label>

        <div className="category-budget-box">
          <label>
            <strong>Atur Budget</strong>
            <input
              checked={form.budgetEnabled}
              className="category-switch"
              onChange={(event) =>
                update("budgetEnabled", event.target.checked)
              }
              type="checkbox"
            />
          </label>
          {form.budgetEnabled ? (
            <input
              className="input"
              min={0}
              onChange={(event) =>
                update("budgetAmount", Number(event.target.value))
              }
              placeholder="Nominal budget bulanan"
              type="number"
              value={form.budgetAmount}
            />
          ) : null}
        </div>

        <div className="category-modal__actions">
          <button
            className="button button--secondary"
            onClick={onClose}
            type="button"
          >
            Batal
          </button>
          <button
            className="button button--primary"
            disabled={loading}
            onClick={onSave}
            type="button"
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
