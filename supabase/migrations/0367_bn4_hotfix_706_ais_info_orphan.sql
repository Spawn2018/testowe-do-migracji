-- BN4 hotfix #706 F7 r1: zamknij INFO AIS_<port> (HEL/HELA/STO/KPS/VUO)
-- powstałe bez przypisanych transportów po przedwczesnym scaleniu #706.
-- 0366 (mapa / granty) bez zmian. Edge B1+B2 w tym samym PR.

begin;

update public.risk_signals rs
   set resolved_at = now()
 where rs.resolved_at is null
   and rs.kind = 'FERRY'
   and rs.severity = 'INFO'
   and (
     rs.dedup_key like 'AIS_HEL:%'
     or rs.dedup_key like 'AIS_HELA:%'
     or rs.dedup_key like 'AIS_STO:%'
     or rs.dedup_key like 'AIS_KPS:%'
     or rs.dedup_key like 'AIS_VUO:%'
   )
   and not exists (
     select 1
       from public.loads l
      where l.sailing_id is not null
        and l.sailing_id::text = split_part(rs.dedup_key, ':', 2)
   );

commit;
