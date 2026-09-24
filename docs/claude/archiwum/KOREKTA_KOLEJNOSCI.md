# KOREKTA KOLEJNOŚCI — przeczytaj zanim cokolwiek przerwiesz

Dostałeś ode mnie 0.5a i 0.5b w trakcie etapu C. Moja pomyłka w timingu,
nie Twoja. **Nie przerywaj tego, co robisz i niczego nie zaczynaj od nowa.**
Etapy A i B są zamknięte i nie wracamy do nich.

Nowa kolejność:

```
1. dokończ plik, który masz w toku
2. commit punktu kontrolnego
3. 0.5a — weryfikacja (poprawiona, patrz niżej)
4. 0.5b — reszta kanonu do repozytorium
5. wracasz do etapu C tam, gdzie przerwałeś
```

---

# POPRAWKA DO 0.5a

Instrukcja, którą dostałeś, porównywała sumy plików w **drzewie roboczym**.
W trakcie etapu C drzewo jest brudne — dopisujesz dokumenty przekazania —
więc to porównanie musiałoby wyjść na czerwono i nic by nie znaczyło.

Porównujemy **drzewa commitów**, nie pliki na dysku. Git gwarantuje, że równa
suma drzewa oznacza identyczną zawartość co do bajtu. Trzy polecenia:

```
cd /workspace/watch-tower-app
git add -A && git commit -m "docs(handover): punkt kontrolny etapu C"
git fetch origin --tags

git rev-parse 305da3e^{tree}
git rev-parse af3ea61^{tree}
```

**Równe sumy drzew → wypchnięcie kompletne, temat zamknięty na zawsze.**

Sumy commitów będą się różnić i to jest normalne — commit zasiewający zmienił
rodzica, więc baseline dostał nowy identyfikator. Liczy się drzewo, nie commit.

Jeżeli sumy drzew się różnią, wypisz co:

```
git diff --stat 305da3e af3ea61
```

Przy okazji sprawdź, co naprawdę siedzi w commicie bazowym:

```
git ls-tree -r --name-only 305da3e | wc -l
git ls-tree -r --name-only 305da3e | grep -E '00_KONTEKST|08_MANIFEST|docs/handover' \
  || echo "brak dokumentów przekazania w baseline"
```

To ma znaczenie, bo tag `baseline-2026-09-23` ma oznaczać **stan wdrożony
i poddany analizie**, a nie stan z dopisanymi później dokumentami. Jeżeli
dokumenty przekazania jednak w nim są — nie cofaj tego, tylko napisz to
w jednej linii. Zapiszemy w rejestrze, że tag obejmuje także dokumentację.
Na build to nie wpływa, ale musi być wiadome.

---

# 0.5b BEZ ZMIAN

Kopiowanie `/workspace/watch-tower/` do `docs/watch-tower/` z zachowaniem
struktury katalogów, plus dowody z `/tmp/wt-*.png` do `docs/evidence/`,
póki jeszcze istnieją. Potem commit i tag `baseline-docs-2026-09-23`.

Jedno uzupełnienie: **nie kopiuj katalogu aplikacji sam w siebie.** Jeżeli
`/workspace/watch-tower/` zawiera `watch-tower-app` albo dowiązanie do niego,
pomiń to razem z `node_modules`.

---

# PO 0.5b

Wracasz do etapu C **od miejsca, w którym przerwałeś**. Nie powtarzaj tego,
co już napisane. Na końcu etapu C napisz jedną linią, które z dziesięciu
plików powstały w tej sesji, a które były gotowe wcześniej.
