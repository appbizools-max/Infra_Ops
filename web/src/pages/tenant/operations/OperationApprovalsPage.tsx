import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ArrowLeft, CheckCircle2, XCircle, Clock,
  AlertCircle, RefreshCw, Filter, FileText, Route, User
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';

export default function OperationApprovalsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reviewerRemarks, setReviewerRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/tenant/operations-approvals/all?status=${filterStatus}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !reviewAction) return;

    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/tenant/operations-approvals/${selectedReq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          reviewerName: 'Admin / Approver',
          remarks: reviewerRemarks
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update request');
      }

      setSuccessMsg(`Change request successfully ${reviewAction.toLowerCase()}d!`);
      setSelectedReq(null);
      setReviewAction(null);
      setReviewerRemarks('');
      fetchRequests();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/tenant/operations"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-600" />
              Operation Change Approvals Inbox
            </h1>
            <p className="text-sm text-slate-500">
              Review, approve or reject operation modifications submitted by Project Managers
            </p>
          </div>
        </div>

        <button
          onClick={fetchRequests}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(st => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterStatus === st
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {st} Requests
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading change requests...</div>
      ) : requests.length === 0 ? (
        <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
          <p className="font-semibold text-slate-600">No {filterStatus.toLowerCase()} requests found</p>
          <p className="text-xs">Any project manager change requests will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => {
            const proposed = typeof req.proposedChanges === 'string' ? JSON.parse(req.proposedChanges) : req.proposedChanges;

            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        {req.opCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : req.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {req.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        Submitted {new Date(req.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{req.operationName}</h3>
                    <p className="text-xs text-slate-500 font-medium">Project: {req.projectName}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Requested by</span>
                    <span className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1">
                      <User className="w-3.5 h-3.5 text-[#00705a]" />
                      {req.requestedByName} ({req.requestedByRole})
                    </span>
                  </div>
                </div>

                {/* Diff & Summary */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    Reason / Summary: <span className="font-normal text-slate-700">{req.summary}</span>
                  </div>

                  {proposed && (
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                      {proposed.corridorName && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Proposed Route / Corridor</span>
                          <span className="font-semibold text-blue-700">{proposed.corridorName}</span>
                        </div>
                      )}
                      {proposed.plannedQuantityTons && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Proposed Planned Quantity</span>
                          <span className="font-semibold text-slate-900">{proposed.plannedQuantityTons} MT</span>
                        </div>
                      )}
                      {proposed.newStockyard && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Stockyard to Add</span>
                          <span className="font-semibold text-emerald-700">
                            {proposed.newStockyard.stockyardName} (Supervisor: {proposed.newStockyard.supervisorName})
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {req.reviewerRemarks && (
                    <div className="pt-2 border-t border-slate-200 text-slate-600">
                      <strong>Reviewer Remarks:</strong> {req.reviewerRemarks} ({req.reviewedByName})
                    </div>
                  )}
                </div>

                {/* Actions for PENDING */}
                {req.status === 'PENDING' && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setReviewAction('REJECT');
                      }}
                      className="px-4 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setReviewAction('APPROVE');
                      }}
                      className="px-4 py-1.5 bg-[#00705a] hover:bg-[#005a48] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve & Apply
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedReq && reviewAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              {reviewAction === 'APPROVE' ? 'Approve & Apply Changes' : 'Reject Change Request'}
            </h3>
            <p className="text-xs text-slate-500">
              {reviewAction === 'APPROVE'
                ? 'Approving this request will automatically apply the requested modifications to the active operation.'
                : 'Rejecting will maintain current operation configurations without changes.'}
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">Reviewer Remarks *</label>
                <textarea
                  rows={3}
                  placeholder="Enter remarks or approval reason..."
                  value={reviewerRemarks}
                  onChange={e => setReviewerRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReq(null);
                    setReviewAction(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold shadow-sm ${
                    reviewAction === 'APPROVE' ? 'bg-[#00705a] hover:bg-[#005a48]' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? 'Processing...' : reviewAction === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
