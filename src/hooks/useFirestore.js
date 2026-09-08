import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useCollection(collectionName, constraints = []) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    let q;
    try {
      q = query(collection(db, collectionName), ...constraints);
    } catch (e) {
      setError(e);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(q,
      (snap) => {
        setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { setError(err); setLoading(false); }
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, JSON.stringify(constraints.map(c => c.toString()))]);

  return { docs, loading, error };
}

export function useDateFilteredCollection(collectionName, fromDate, toDate) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    const q = query(
      collection(db, collectionName),
      where('timestamp', '>=', Timestamp.fromDate(fromDate)),
      where('timestamp', '<=', Timestamp.fromDate(toDate)),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [collectionName, fromDate?.toISOString(), toDate?.toISOString()]);

  return { docs, loading };
}
