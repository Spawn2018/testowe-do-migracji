set session_replication_role = replica;
delete from positions where load_id in (select id from loads where order_no like 'PERF/%');
delete from load_events where load_id in (select id from loads where order_no like 'PERF/%');
delete from risk_signals where load_id in (select id from loads where order_no like 'PERF/%');
delete from loads where order_no like 'PERF/%';
set session_replication_role = origin;
