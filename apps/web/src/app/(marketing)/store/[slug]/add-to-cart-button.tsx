'use client';

interface AddToCartButtonProps {
  accent: string;
  productTitle: string;
}

export function AddToCartButton({ accent, productTitle }: AddToCartButtonProps) {
  return (
    <button
      type="button"
      className="store-add-btn"
      onClick={() => alert(`"${productTitle}" — Funcionalidade de carrinho em breve!`)}
      style={{
        padding: '10px 20px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        border: 'none',
        background: accent,
        color: '#ffffff',
        transition: 'opacity 0.15s ease',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      Adicionar
    </button>
  );
}
