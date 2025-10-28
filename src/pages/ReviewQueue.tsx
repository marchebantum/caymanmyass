import { useEffect, useState } from 'react';
import { Eye, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ReviewQueueItem } from '../lib/database.types';

export function ReviewQueue() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewed, setShowReviewed] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadItems();
  }, [showReviewed]);

  async function loadItems() {
    try {
      setLoading(true);
      let query = supabase
        .from('review_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (!showReviewed) {
        query = query.eq('reviewed', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading review queue:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsReviewed(itemId: string) {
    try {
      const { error } = await supabase
        .from('review_queue')
        .update({
          reviewed: true,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq('id', itemId);

      if (error) throw error;
      loadItems();
    } catch (error) {
      console.error('Error marking as reviewed:', error);
    }
  }

  function getPriorityBadge(priority: string) {
    const styles = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[priority as keyof typeof styles] || styles.medium}`}>
        {priority}
      </span>
    );
  }

  function getItemTypeBadge(itemType: string) {
    const styles = {
      case: 'bg-blue-100 text-blue-800',
      gazette_notice: 'bg-green-100 text-green-800',
      gazette_issue: 'bg-purple-100 text-purple-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[itemType as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {itemType.replace(/_/g, ' ')}
      </span>
    );
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function viewItem(item: ReviewQueueItem) {
    try {
      let itemData = null;

      if (item.item_type === 'case') {
        const { data, error } = await supabase
          .from('cases')
          .select('*, registry_rows(*)')
          .eq('id', item.item_id)
          .single();

        if (error) throw error;
        itemData = data;
      } else if (item.item_type === 'gazette_notice') {
        const { data, error } = await supabase
          .from('gazette_notices')
          .select('*, gazette_issues(*)')
          .eq('id', item.item_id)
          .single();

        if (error) throw error;
        itemData = data;
      } else if (item.item_type === 'gazette_issue') {
        const { data, error } = await supabase
          .from('gazette_issues')
          .select('*')
          .eq('id', item.item_id)
          .single();

        if (error) throw error;
        itemData = data;
      }

      setSelectedItem({
        ...item,
        details: itemData,
      });
    } catch (error) {
      console.error('Error loading item details:', error);
      alert('Failed to load item details');
    }
  }

  const unreviewed = items.filter(item => !item.reviewed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-600 mt-2">Items flagged for manual review</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showReviewed"
            checked={showReviewed}
            onChange={(e) => setShowReviewed(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="showReviewed" className="text-sm font-medium text-gray-700">
            Show reviewed items
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total in Queue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{unreviewed}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">High Priority</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {items.filter(item => !item.reviewed && item.priority === 'high').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Reviewed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {items.filter(item => item.reviewed).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading review queue...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {showReviewed ? 'No items in queue' : 'No items pending review'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.reviewed ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getItemTypeBadge(item.item_type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      {item.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPriorityBadge(item.priority)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.reviewed ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle size={16} />
                          Reviewed
                        </span>
                      ) : (
                        <span className="text-amber-600 text-sm">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewItem(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View item"
                        >
                          <Eye size={16} />
                        </button>
                        {!item.reviewed && (
                          <button
                            onClick={() => markAsReviewed(item.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Mark as reviewed"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Review Queue Item</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedItem.item_type}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Reason for Review</h3>
                  <p className="text-gray-700">{selectedItem.reason}</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Priority</h3>
                  {getPriorityBadge(selectedItem.priority)}
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Item Details</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm font-mono overflow-x-auto">
                      {JSON.stringify(selectedItem.details, null, 2)}
                    </pre>
                  </div>
                </div>

                {selectedItem.notes && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Notes</h3>
                    <p className="text-gray-700">{selectedItem.notes}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              {!selectedItem.reviewed && (
                <button
                  onClick={() => {
                    markAsReviewed(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark as Reviewed
                </button>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
