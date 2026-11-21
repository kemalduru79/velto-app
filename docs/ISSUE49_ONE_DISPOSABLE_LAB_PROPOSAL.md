# One disposable lab option — grouped owner decision, NOT PROVISIONED

Proposed provisioner, billing and cleanup/retention owner: **kemalduru79 (Product Owner), acceptance pending**. Codex implements only in the approved nonproduction project after scope/artifact prerequisites pass. No existing Railway environment is used. No credentials in chat.

## One concrete option
New AWS project VeltoP0ScientificLab, no production links, peers, secrets or customer data. Require AWS Settings project spend-limit eligibility AND the networking/IAM controls below. If incompatible, STOP; never substitute an uncapped advanced account.

Proposed names are labels, not existing IDs:
- velto49-ledger: t3.small (x86_64,2vCPU/2GiB), us-east-1, encrypted16GiB gp3, PostgreSQL admission/server-time/epoch coordinator.
- velto49-watchdog: t3.small, us-west-2, encrypted16GiB gp3, independent synchronous consumed-tail witness, Node22 supervisor/reconciler, durable observer and scoped external worker fence.
- velto49-worker: t3.medium (x86_64,2vCPU/4GiB), separate us-east-1 availability zone, encrypted16GiB gp3, sole engine broker/interlock and isolated worker. T3 STANDARD credit mode; no Unlimited billing.
- Two regional isolated networks, narrow authenticated control channels. No public app endpoints, NAT gateway, load balancer, domain, snapshots, autoscaling or marketplace images. Management only from owner's fixed approved address. Scientific workload egress disabled; no engine socket/host mounts in workload.
- Real account/project/instance/volume/security-group/role/AMI IDs, host fingerprints and qualified tool/package identities remain **MISSING**. No fabricated identity is executable authority.

Two regions separate coordinator/worker from watchdog/witness host/region loss, while sharing AWS/account control-plane risk. Permission requires independent witness persistence; partition/unknown commit denies. Watchdog must fence/observe actual host loss; stock Docker/PostgreSQL/EC2 alone does not prove pre-effect fencing. Implement and execute frozen cases before qualifying controls.

## Hard bounds and cleanup
- **Requested hard project ceiling $20 pre-tax; maximum owner authorization $25 including taxes/fees.** Allocation ceilings: compute$5, storage/retention$2, management/control network$3, contingency$10 pre-tax. These are limits, not vendor quotes.
- AWS's documented spend limit has minimum$20 and pauses project resources at limit. Ordinary budget alerts are NOT substitutes. Owner verifies feature, inclusion of all resources, taxes/fees<=$5, narrow networking/IAM availability and effective limit before billable creation. Otherwise non-executable.
- Worker/build TTL120min total; two builds<=30min each,2vCPU/4GiB,8GiB scratch, no build/workload egress. At most20 exact canaries; no ambiguous-key reruns. Management/control traffic<=1GiB; quarantine intake only original95,207,286bytes.
- Kill: owner independently terminates worker via console; watchdog role may stop/terminate only exact worker ID. No broad credential reaches worker. Both stop paths tested before workload.
- At120min terminate worker. Export hash-bound receipts to owner storage; delete remaining instances/volumes/networks/roles within24h. No snapshots/unattended recurring services. Owner verifies zero billed resources; paused is not deleted.
- Privacy-safe local receipts retained30days by owner. Uncertain cleanup freezes dispatch and is reported.

Price reference, not multi-region quote: AWS publishes US-East Linux t3.small$0.0209/h and t3.medium$0.0418/h; two-hour3-instance compute reference$0.1672 before regional differences/storage/network/tax. Recheck account quote; no purchase authorized.
Sources checked2026-11-15:
- https://aws.amazon.com/ec2/instance-types/t3/
- https://docs.aws.amazon.com/accounts/latest/reference/create-spend-limit.html
- https://docs.aws.amazon.com/accounts/latest/reference/use-aws-settings.html

## One grouped decision
Approve named owner's responsibilities, one disposable project and exact counts/TTL/budget, CONDITIONED on verified spend-limit/network/IAM eligibility and quote within cap. Record genuine IDs before execution. No automatic region/vendor/account fallback.

Still mandatory: publisher authentication, exact artifact pins, ABI/ELF/wheel closure, reviewed zlib remediation, final image/SBOM/high-critical dispositions, real durable fencing/watchdog and OS-isolation proof, then exact20 cases. Original10 artifacts remain bounded; supplemental verifier/scanner/PostgreSQL/OS identities stay MISSING and arbitrary download is not approved by this infrastructure proposal. One consolidated exact supplemental manifest is required before acquisition.

No resources, binaries, images or containers acquired/created here. Physical0PASS/0FAIL/20NOT_RUN. G0/G0-08, Scientific Runtime and production NO-GO.
