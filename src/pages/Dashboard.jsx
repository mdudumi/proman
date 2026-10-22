import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import DitorTable from "../components/DitorTable";
import DitorForm from "../components/DitorForm";
import Modal from "../components/Modal";
import "./Dashboard.css";

export default function Dashboard() {
  const { setOpenAddModal } = useOutletContext();
  const [showAdd, setShowAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setOpenAddModal(() => () => setShowAdd(true));
    return () => setOpenAddModal(null);
  }, [setOpenAddModal]);

  return (
    <div className="main main--single">
      <div className="right right--full">
        <div className="rightTitle">Të dhëna të regjistruara</div>
        <div className="rightBody">
          <DitorTable refreshKey={refreshKey} />
        </div>
      </div>

      {showAdd && (
        <Modal title="Shto të dhënë" onClose={() => setShowAdd(false)}>
          {/* Stays open after saving so several entries can be added in a row; the ✕ closes it. */}
          <DitorForm
            mode="create"
            onSaved={() => setRefreshKey(k => k + 1)}
          />
        </Modal>
      )}
    </div>
  );
}

