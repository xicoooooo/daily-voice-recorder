const ConfirmModal = ({ open, title, message, onConfirm, onCancel }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-gray-600 mb-4">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="text-gray-600">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="bg-red-500 text-white px-4 py-1 rounded"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;