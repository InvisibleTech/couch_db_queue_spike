# Simple POC for Store And Forward Messaging With Couchcb 
This was project was used to spike out an idea of having an expiring store and forward message system. The basis is couchcb changes log. This is not meant for use with critical and non-idempotent task requests. It targets event processing for getting data for real world events where some rules apply:

* The sending system has a don't know/don't care policy for data sent
* The data sent is based on something real like a person entering a building and signing in at a kiosk, they won't stop being in the building if we eventually expire this message because an onsite message processor is not running.
* The data can be resent, like adding people and their pictures to a database and if we saw them already with can ignore or just re-apply the same data.
* Low volume events are the target: a visitor sign-in/sign-out and adding employees. If we had high volume eventing we would use something like Kafka in the middle.

## Some Constraints Put On This POC
During discussions as to whether or not we should run a full messaging service or leverage a managed service that was publically exposed and required securing against potentially many client on prem installations we stayed with the idea of the "uplink" where the on prem server used a secure websocket connection to pull data routed to it. We also, did not want the cost or requirement of a managed enterprise level messaging system in the cloud on any specific vendor.
