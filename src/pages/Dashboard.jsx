import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import DitorTable from "../components/DitorTable";
import DitorForm from "../components/DitorForm";
import Modal from "../components/Modal";
import "./Dashboard.css";

export default function Dashboard() {
  const { setOpenAddModal } = useOutletContext();
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    setOpenAddModal(() => () => setShowAdd(true));
    return () => setOpenAddModal(null);
  }, [setOpenAddModal]);

  return (
    <div className="main main--single">
      <div className="right right--full">
        <div className="rightTitle">Të dhëna të regjistruara</div>
        <div className="rightBody">
          <DitorTable />
        </div>
      </div>

      {showAdd && (
        <Modal title="Shto të dhënë" onClose={() => setShowAdd(false)}>
          <DitorForm
            mode="create"
            onSaved={() => setShowAdd(false)}
          />
        </Modal>
      )}
    </div>
  );
}

